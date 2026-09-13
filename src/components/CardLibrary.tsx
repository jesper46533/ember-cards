import { useMemo, useState } from 'react'
import { DEFAULT_DECK } from '../engine/defaultDeck.ts'
import { parseCustomCards, type Card, type Deck, type Kind, type Tier } from '../engine/cards.ts'
import { kindLabel } from '../engine/game.ts'
import { TIER_THEMES } from '../theme.ts'

interface Props {
  deck: Deck
  onChange(next: Deck): void
  onClose(): void
}

const KIND_ORDER: Kind[] = ['truth', 'dare', 'wild']

// 编号 < 9000 视为内置牌；玩家的牌都从 9001 起发号，天然不撞。
function isCustom(card: Card): boolean {
  return card.no >= 9000
}

function deckToText(deck: Deck): string {
  return deck.cards
    .map((c) => `${c.tier} ${kindLabel(c.kind)} ${c.text}`)
    .join('\n')
}

export default function CardLibrary({ deck, onChange, onClose }: Props) {
  const [tierFilter, setTierFilter] = useState<Tier | 0>(0)
  const [kindFilter, setKindFilter] = useState<Kind | 0>(0)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [newTier, setNewTier] = useState<Tier>(3)
  const [newKind, setNewKind] = useState<Kind>('truth')
  const [newText, setNewText] = useState('')
  const [ioOpen, setIoOpen] = useState(false)
  const [ioText, setIoText] = useState('')
  const [ioMsg, setIoMsg] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return deck.cards.filter((c) => {
      if (tierFilter !== 0 && c.tier !== tierFilter) return false
      if (kindFilter !== 0 && c.kind !== kindFilter) return false
      if (q && !c.text.toLowerCase().includes(q)) return false
      return true
    })
  }, [deck, tierFilter, kindFilter, search])

  function updateCard(no: number, text: string) {
    onChange({ ...deck, cards: deck.cards.map((c) => (c.no === no ? { ...c, text } : c)) })
  }

  function deleteCard(no: number) {
    onChange({ ...deck, cards: deck.cards.filter((c) => c.no !== no) })
  }

  function addCard() {
    const text = newText.trim()
    if (!text) return
    const nextNo = Math.max(9000, ...deck.cards.map((c) => c.no)) + 1
    onChange({ ...deck, cards: [...deck.cards, { no: nextNo, tier: newTier, kind: newKind, text }] })
    setNewText('')
    setAddOpen(false)
  }

  function restoreDefaults() {
    if (!window.confirm('恢复成内置的 100 张默认牌？你自己加的牌会被清掉，建议先导出备份。')) return
    onChange(DEFAULT_DECK)
  }

  function doExport() {
    setIoText(deckToText(deck))
    setIoMsg(null)
    setIoOpen(true)
  }

  function doImport() {
    const parsed = parseCustomCards(ioText)
    const existing = new Set(deck.cards.map((c) => c.text))
    const fresh = parsed.cards.filter((c) => !existing.has(c.text))
    if (fresh.length) {
      let nextNo = Math.max(9000, ...deck.cards.map((c) => c.no))
      const numbered = fresh.map((c) => ({ ...c, no: ++nextNo }))
      onChange({ ...deck, cards: [...deck.cards, ...numbered] })
    }
    const dupes = parsed.cards.length - fresh.length
    setIoMsg(
      fresh.length || parsed.skipped || dupes
        ? `导入完成：新增 ${fresh.length} 张${dupes > 0 ? `，${dupes} 张与牌库重复已跳过` : ''}${parsed.skipped > 0 ? `，${parsed.skipped} 行没看懂（格式：档位1-5 真心话/大冒险 文案）` : ''}。`
        : '没有可导入的新牌（格式：档位1-5 真心话/大冒险 文案）。',
    )
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet cardlib" onClick={(e) => e.stopPropagation()}>
        <div className="cardlib-head">
          <div>
            <h2>牌库</h2>
            <p className="muted">共 {deck.cards.length} 张 · 当前显示 {filtered.length} 张，改了立刻进抽牌池</p>
          </div>
          <button type="button" className="link" onClick={onClose}>关闭</button>
        </div>

        <input
          className="cardlib-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜牌面文案…"
        />

        <div className="cardlib-filters">
          <div className="chips">
            {([0, 1, 2, 3, 4, 5] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`chip ${tierFilter === t ? 'on' : ''}`}
                style={t !== 0 ? { background: TIER_THEMES[t - 1].background, color: TIER_THEMES[t - 1].text } : undefined}
                onClick={() => setTierFilter(t as Tier | 0)}
              >
                {t === 0 ? '全部档' : deck.tierNames[t]}
              </button>
            ))}
          </div>
          <div className="chips">
            {([0, 'truth', 'dare', 'wild'] as const).map((k) => (
              <button key={k} type="button" className={`chip ${kindFilter === k ? 'on' : ''}`} onClick={() => setKindFilter(k as Kind | 0)}>
                {k === 0 ? '全部类型' : kindLabel(k)}
              </button>
            ))}
          </div>
        </div>

        <div className="cardlib-list">
          {filtered.map((c) => (
            <div key={c.no} className="cardlib-row">
              <div className="cardlib-badges">
                <span className="badge" style={{ background: TIER_THEMES[c.tier - 1].background, color: TIER_THEMES[c.tier - 1].text }}>
                  {deck.tierNames[c.tier]}
                </span>
                <span className="badge">{kindLabel(c.kind)}</span>
                {isCustom(c) && <span className="badge badge-own">我的</span>}
              </div>
              <textarea
                className="cardlib-edit"
                rows={2}
                value={c.text}
                maxLength={300}
                onChange={(e) => updateCard(c.no, e.target.value)}
              />
              <button type="button" className="link danger" onClick={() => deleteCard(c.no)} aria-label={`删除 ${c.text.slice(0, 12)}…`}>
                删除
              </button>
            </div>
          ))}
          {!filtered.length && <p className="hint">这里没有符合条件的牌。</p>}
        </div>

        <div className="cardlib-actions">
          <button type="button" className="btn small" onClick={() => setAddOpen(!addOpen)}>
            {addOpen ? '收起' : '＋ 加一张'}
          </button>
          <button type="button" className="btn small" onClick={doExport}>
            导出文本
          </button>
          <button type="button" className="btn small" onClick={() => { setIoText(''); setIoMsg(null); setIoOpen(!ioOpen) }}>
            导入文本
          </button>
          <button type="button" className="btn small btn-dark" onClick={restoreDefaults}>
            恢复默认
          </button>
        </div>

        {addOpen && (
          <div className="cardlib-add">
            <select value={newTier} onChange={(e) => setNewTier(Number(e.target.value) as Tier)}>
              {([1, 2, 3, 4, 5] as const).map((t) => (
                <option key={t} value={t}>{deck.tierNames[t]}</option>
              ))}
            </select>
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as Kind)}>
              {KIND_ORDER.map((k) => (
                <option key={k} value={k}>{kindLabel(k)}</option>
              ))}
            </select>
            <textarea
              rows={2}
              value={newText}
              maxLength={300}
              placeholder="牌面文案，一句指令或一个问题。"
              onChange={(e) => setNewText(e.target.value)}
            />
            <button type="button" className="btn btn-primary small" disabled={!newText.trim()} onClick={addCard}>
              加进牌库
            </button>
          </div>
        )}

        {ioOpen && (
          <div className="cardlib-io">
            <p className="hint">
              导出：全部牌转成纯文本，发给对方粘贴进「导入」就能共享。导入：一行一张「档位1-5 真心话/大冒险 文案」，与牌库重复的会自动跳过。
            </p>
            <textarea rows={6} value={ioText} onChange={(e) => setIoText(e.target.value)} />
            <div className="cardlib-io-btns">
              <button type="button" className="btn small btn-primary" disabled={!ioText.trim()} onClick={doImport}>
                导入
              </button>
              <button type="button" className="btn small" onClick={() => setIoOpen(false)}>
                收起
              </button>
            </div>
            {ioMsg && <p className="hint">{ioMsg}</p>}
          </div>
        )}
      </div>
    </div>
  )
}