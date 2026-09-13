import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './engine/defaultDeck.ts'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 生产环境注册 Service Worker，让牌局能"添加到主屏幕"后离线可玩。
// 开发时不注册，免得和 Vite 的 HMR 抢缓存。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // 注册失败就当普通网页跑，牌局照玩。
  })
}
