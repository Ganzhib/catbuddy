/**
 * IPC Handlers — 注册所有 main process 侧的 IPC 处理
 */
import { ipcMain, app } from 'electron'
import { AgentLoop } from '../agent/loop'
import { SessionManager } from '../session/session-manager'
import type { learnbuddyConfig } from '../../shared/types'

export function registerIpcHandlers(
  agentLoop: AgentLoop,
  sessions: SessionManager,
  config: learnbuddyConfig,
) {
  // ═══ Agent ═══
  // IPC 消息 → bus.inbound → run() → _dispatch() → bus.outbound → DesktopChannel → 前端
  ipcMain.handle('agent:send', async (_event, { chatId, content, media }: { chatId?: string; content: string; media?: string[] }) => {
    const id = (chatId && !chatId.startsWith('desktop:')) ? `desktop:${chatId}` : (chatId || 'desktop:main')
    const bus = agentLoop.bus;
    if (!bus) throw new Error("AgentLoop must be initialized with a MessageBus");
    bus.publishInbound({
      channel: 'desktop',
      senderId: 'user',
      chatId: id,
      content,
      media: media ?? [],
      timestamp: Date.now(),
      metadata: {},
      sessionKeyOverride: id,
    });
    return { ok: true };
  })

  ipcMain.handle('agent:stop', async (_event, { sessionKey }: { sessionKey: string }) => {
    await agentLoop.cancelSession(sessionKey)
  })

  ipcMain.handle('agent:status', async () => ({
    running: true,
    model: agentLoop.model,
    uptime: agentLoop.uptime,
    activeSessions: agentLoop.activeSessionCount,
  }))

  // ═══ Session ═══
  ipcMain.handle('session:list', async () => sessions.list())
  ipcMain.handle('session:get', async (_event, { key }: { key: string }) => sessions.getDetail(key))
  ipcMain.handle('session:delete', async (_event, { key }: { key: string }) => sessions.delete(key))
  ipcMain.handle('session:clear', async (_event, { key }: { key: string }) => sessions.clear(key))
  ipcMain.handle('session:new', async () => ({
    key: `desktop:${Date.now()}`,
  }))

  // ═══ Config ═══
  ipcMain.handle('config:get', async () => config)
  ipcMain.handle('config:update', async (_event, { path, value }: { path: string; value: unknown }) => {
    const keys = path.split('.')
    let obj: any = config
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]]
    obj[keys[keys.length - 1]] = value

    // 压缩配置实时生效
    if (path === 'agents.defaults.autoCompact' && typeof value === 'object') {
      const v = value as any
      agentLoop.setCompactConfig({ enabled: v.enabled !== false, threshold: v.threshold ?? 50 })
    }

    // Model 切换实时生效
    if (path === 'agents.defaults.model' && typeof value === 'string') {
      agentLoop.setModel(value)
    }

    // Provider API key 变更 → 重建 fallback provider
    if (path.startsWith('providers.') && path.endsWith('.apiKey')) {
      console.log('[config] Provider updated, reloading...')
      try {
        const { createProvider } = await import('../providers/factory.js')
        const newProvider = createProvider(config)
        agentLoop.setProvider(newProvider)
        const agentLoop2: any = agentLoop
        if (agentLoop2._provider_snapshot_loader) agentLoop2._provider_signature = null
      } catch (err: any) {
        console.error('[config] Failed to reload provider:', err.message)
      }
    }
  })

  ipcMain.handle('config:list-models', async () => {
    const presets = config.modelPresets ?? {}
    return Object.values(presets)
  })

  ipcMain.handle('config:set-model', async (_event, { presetName }: { presetName: string }) => {
    agentLoop.setModelPreset(presetName)
  })

  // ═══ Workspace ═══
  ipcMain.handle('workspace:get', async () => agentLoop.workspace)

  ipcMain.handle('workspace:select', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Workspace',
    })
    return result.canceled ? agentLoop.workspace : result.filePaths[0]
  })

  // ═══ Skills ═══
  ipcMain.handle('skills:list', async () => agentLoop.listSkills())
  ipcMain.handle('skills:toggle', async (_event, { name, enabled }: { name: string; enabled: boolean }) => {
    agentLoop.toggleSkill(name, enabled)
  })

  // ═══ Restart ═══
  ipcMain.handle('app:restart', async () => {
    console.log('[main] Restarting app...')
    app.relaunch()
    app.exit(0)
  })

  // ═══ Channels ═══
  ipcMain.handle('channels:status', async () => ({}))
}
