/**
 * Electron 主进程入口
 */
import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { registerIpcHandlers } from './ipc/handlers.js'
import { AgentLoop } from './agent/agent-loop.js'
import { createProvider } from './providers/factory.js'
import { SessionManager } from './session/session-manager.js'
import { getDefaultConfig } from './config/defaults.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 加载 .env 文件（无外部依赖）
function loadEnvFile(filePath: string) {
  try {
    console.log('[main] Loading env from:', filePath, 'exists:', fs.existsSync(filePath))
    const content = fs.readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
    console.log('[main] .env loaded, DEEPSEEK_KEY=', process.env.DEEPSEEK_KEY ? 'SET' : 'NOT SET')
  } catch (err: any) { console.log('[main] No .env:', err.message) }
}

// 按优先级加载 .env（延迟到 app ready 后）

let mainWindow: BrowserWindow | null = null
let agentLoop: AgentLoop | null = null
let sessions: SessionManager | null = null

function getPreloadPath(): string {
  // 使用纯 CJS 的 preload.cjs（项目根目录），绕过 ESM 编译问题
  return path.join(__dirname, '../preload.cjs')
}

function createWindow() {
  const preloadPath = getPreloadPath()
  console.log('[main] Preload path:', preloadPath)

  // 去除默认菜单栏（File, Edit, View, Window, Help）
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'nanobot',
    autoHideMenuBar: true,   // Windows/Linux 隐藏菜单栏
    icon: path.join(__dirname, '../electron/assets/icon.png'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

async function initBackend() {
  console.log('[main] Initializing backend...')
  const config = getDefaultConfig()
  const userData = app.getPath('userData')
  const workspace = path.join(userData, 'workspace')
  console.log('[main] Workspace:', workspace)

  // 首次启动时创建配置目录和 config.json
  const configDir = path.join(userData, 'config')
  const configFile = path.join(configDir, 'config.json')
  try {
    const fs = await import('node:fs')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8')
    // 将 config_path 写入 config 对象，供前端 Settings 展示
    ;(config as any).runtime = { config_path: configFile }
    console.log('[main] Config written to:', configFile)
  } catch {}
  console.log('[main] Workspace:', workspace)

  sessions = new SessionManager(workspace)
  
  try {
    const provider = createProvider(config)
    agentLoop = new AgentLoop({
      provider,
      workspace,
      model: config.agents.defaults.model,
      maxIterations: config.agents.defaults.maxToolIterations,
      maxMessages: config.agents.defaults.maxMessages,
      contextWindowTokens: config.agents.defaults.contextWindowTokens,
      restrictToWorkspace: config.tools.restrictToWorkspace,
      sessionManager: sessions,
    })
    registerIpcHandlers(agentLoop, sessions, config)
    console.log('[main] Backend initialized successfully')
  } catch (err: any) {
    console.error('[main] Backend init failed:', err.message)
    // 即使 backend 失败也注册一个降级 handler，让前端能启动
    registerFallbackHandlers(sessions, config)
  }
}

/** 降级模式：backend 不可用，至少让 session list / config 等工作 */
function registerFallbackHandlers(sessions: SessionManager, config: any) {
  ipcMain.handle('agent:status', () => ({
    running: false, model: config.agents.defaults.model, uptime: 0, activeSessions: 0,
  }))
  ipcMain.handle('agent:send', () => { throw new Error('Backend not initialized') })
  ipcMain.handle('session:list', () => sessions.list())
  ipcMain.handle('session:get', (_e, { key }) => sessions.getDetail(key))
  ipcMain.handle('session:delete', (_e, { key }) => sessions.delete(key))
  ipcMain.handle('session:clear', (_e, { key }) => sessions.clear(key))
  ipcMain.handle('session:new', () => ({ key: `desktop:${Date.now()}` }))
  ipcMain.handle('config:get', () => config)
  ipcMain.handle('config:list-models', () => [])
  ipcMain.handle('workspace:get', () => app.getPath('userData'))
  ipcMain.handle('skills:list', () => [])
  ipcMain.handle('channels:status', () => ({}))
}

app.whenReady().then(async () => {
  // 0. 加载 .env
  loadEnvFile(path.join(__dirname, '../.env'))
  loadEnvFile(path.join(app.getPath('home'), '.nanobot.env'))
  console.log('[main] DEEPSEEK_KEY=', process.env.DEEPSEEK_KEY ? 'SET' : 'NOT SET')

  // 1. 先创建窗口
  createWindow()

  // 2. 再初始化 backend
  await initBackend()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {})
