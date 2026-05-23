/**
 * Termax 应用入口
 * 挂载 React 根组件，引入全局样式（xterm.css + index.css）
 *
 * 窗口尺寸恢复在 React 挂载前执行（窗口初始隐藏，恢复尺寸后再显示），
 * 避免用户看到从默认尺寸到记忆尺寸的跳变。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { addCollection } from '@iconify/react'
import solarIcons from '@iconify-json/solar/icons.json'
import '@xterm/xterm/css/xterm.css'
import './styles/xterm.css'
import './index.css'
import App from './App.tsx'
import { debugTime } from '@/lib/debug'
import termaxTheme from '@/themes/termax'

// 预加载 Solar 图标集到本地缓存，避免 CDN 网络请求导致的图标加载失败
addCollection(solarIcons)

// 全局禁用浏览器右键菜单（包括白屏/React 未渲染时）
document.addEventListener('contextmenu', (e) => e.preventDefault())

// React 挂载前同步应用主题 token，确保首帧有正确的 CSS 变量值（无 FOUC）
// 仅应用 termax 默认主题作为首帧占位，App.tsx 会在挂载后应用用户选择的完整主题
const _initDark = document.documentElement.classList.toggle('dark',
  (JSON.parse(localStorage.getItem('termax-settings') || '{}').state?.appTheme || 'dark') !== 'light'
)
const _initTokens = _initDark ? termaxTheme.dark : termaxTheme.light
for (const [k, v] of Object.entries(_initTokens)) {
  document.documentElement.style.setProperty(k, v)
}

// 在 React 挂载前恢复窗口尺寸，消除启动时的尺寸跳变
debugTime('termax-boot');
(async () => {
  try {
    const win = getCurrentWindow()

    // SFTP 独立窗口直接显示，无需恢复尺寸
    if (window.location.hash.startsWith('#/sftp')) {
      await win.show()
      return
    }

    // 读取用户是否开启"记住窗口尺寸"
    const settingsRaw = localStorage.getItem('termax-settings')
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {}
    if (settings.state?.rememberWindowSize) {
      const savedW = localStorage.getItem('termax_window_w')
      const savedH = localStorage.getItem('termax_window_h')
      if (savedW && savedH) {
        const w = Math.min(Number(savedW), 1200)
        const h = Math.min(Number(savedH), 800)
        await win.setSize(new LogicalSize(w, h))
      }
    }

    await win.show()
  } catch {
    // 恢复失败也要确保窗口可见
    await getCurrentWindow().show().catch(() => {})
  }
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
