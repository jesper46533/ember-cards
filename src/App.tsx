import { useEffect, useState } from 'react'
import Table from './components/Table.tsx'
import CardLibrary from './components/CardLibrary.tsx'
import { DEFAULT_DECK } from './engine/defaultDeck.ts'
import { mergeDecks, parseCustomCards, type Deck } from './engine/cards.ts'
import {
  acceptDecree,
  challenge,
  done,
  GameError,
  newGame,
  pick,
  setDecree,
  skip,
  stop,
  type GameState,
  type Mode,
  type Player,
  type Verdict,
} from './engine/game.ts'
import type { Tier } from './engine/cards.ts'

const STORAGE_KEY = 'ember-cards:v1'

export interface Settings {
  names: Record<Player, string>
  wildEnabled: boolean
  // 安全词：你们自己的那个词。按下去就是真停，不讨价。
  safeword: string
  // 旧字段：以前「我们的牌」文本框里的内容，现在只在首次迁移进牌库副本时读一次。
  customCardsText: string
}

interface Persisted {
  settings: Settings
  game: GameState | null
  // 牌库全量副本（默认库 + 玩家增删改的结果），存在本机，编辑立即进抽牌池。
  deck: Deck
}

const DEFAULT_SETTINGS: Settings = {
  names: { a: '甲', b: '乙' },
  wildEnabled: true,
  safeword: '停',
  customCardsText: '',
}

function isDeck(x: unknown): x is Deck {
  const d = x as Deck | null
  return Boolean(d && Array.isArray(d.cards) && d.tierNames && typeof d.tierNames === 'object')
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { settings: DEFAULT_SETTINGS, game: null, deck: DEFAULT_DECK }
    const parsed = JSON.parse(raw) as Partial<Persisted>
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      ...(parsed.settings ?? {}),
      names: { ...DEFAULT_SETTINGS.names, ...(parsed.settings?.names ?? {}) },
    }
    // 老玩家存的牌库没有副本，把旧的「我们的牌」文本合进默认库迁移过来。
    const deck = isDeck(parsed.deck)
      ? parsed.deck
      : mergeDecks(DEFAULT_DECK, parseCustomCards(settings.customCardsText).cards)
    return {
      settings,
      game: parsed.game && parsed.game.version === 1 ? parsed.game : null,
      deck,
    }
  } catch {
    return { settings: DEFAULT_SETTINGS, game: null, deck: DEFAULT_DECK }
  }
}

export default function App() {
  const [{ settings, game, deck }, setPersisted] = useState<Persisted>(load)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, game, deck }))
    } catch {
      // 存不下就存不下，牌局照玩
    }
  }, [settings, game, deck])

  function setGame(next: GameState | null) {
    setPersisted((p) => ({ ...p, game: next }))
  }

  function setSettings(patch: Partial<Settings>) {
    setPersisted((p) => ({ ...p, settings: { ...p.settings, ...patch } }))
  }

  function setDeck(next: Deck) {
    setPersisted((p) => ({ ...p, deck: next }))
  }

  function run(fn: () => GameState | null) {
    try {
      setError(null)
      setGame(fn())
    } catch (e) {
      setError(e instanceof GameError ? e.message : '这一步没走成，再试一次')
    }
  }

  const actions = {
    newGame: (mode: Mode) => run(() => newGame(mode, { wildEnabled: settings.wildEnabled })),
    pick: (kind: 'truth' | 'dare', tier?: Tier) => run(() => (game ? pick(game, kind, tier, { deck }) : null)),
    done: () => run(() => (game ? done(game) : null)),
    skip: () => run(() => (game ? skip(game) : null)),
    stop: () => run(() => (game ? stop(game) : null)),
    challenge: (verdict: Verdict) => run(() => (game ? challenge(game, verdict) : null)),
    setDecree: (text: string) => run(() => (game ? setDecree(game, text) : null)),
    acceptDecree: () => run(() => (game ? acceptDecree(game) : null)),
    reset: () => run(() => null),
  }

  const openLibrary = () => {
    setSettingsOpen(false)
    setLibraryOpen(true)
  }

  return (
    <div className="app">
      <Table
        game={game}
        deck={deck}
        settings={settings}
        error={error}
        actions={actions}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenLibrary={openLibrary}
      />
      {settingsOpen && (
        <div className="sheet-backdrop" onClick={() => setSettingsOpen(false)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); setSettingsOpen(false) }}>
            <h2>设置</h2>
            <label>
              甲的名字
              <input value={settings.names.a} maxLength={12} onChange={(e) => setSettings({ names: { ...settings.names, a: e.target.value } })} />
            </label>
            <label>
              乙的名字
              <input value={settings.names.b} maxLength={12} onChange={(e) => setSettings({ names: { ...settings.names, b: e.target.value } })} />
            </label>
            <label>
              安全词（按钮上显示的字）
              <input value={settings.safeword} maxLength={8} onChange={(e) => setSettings({ safeword: e.target.value })} />
            </label>
            <label className="row">
              <input type="checkbox" checked={settings.wildEnabled} onChange={(e) => setSettings({ wildEnabled: e.target.checked })} />
              抽牌池混入变数牌（下一局生效）
            </label>
            <div className="cardlib-entry">
              <span>牌库：查看、修改、增删全部 {deck.cards.length} 张牌，改动立刻进抽牌池，只存在本机。导出成文本发给对方，也能导入对方的牌。</span>
              <button type="button" className="btn small" onClick={openLibrary}>打开牌库</button>
            </div>
            <button type="submit" className="btn btn-primary">好了</button>
          </form>
        </div>
      )}
      {libraryOpen && <CardLibrary deck={deck} onChange={setDeck} onClose={() => setLibraryOpen(false)} />}
    </div>
  )
}