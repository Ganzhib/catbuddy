/**
 * IPC Handlers — 注册所有 main process 侧的 IPC 处理
 */
import fs from 'node:fs'
import path from 'node:path'
import { ipcMain, app, BrowserWindow, shell } from 'electron'
import { AgentLoop } from '../agent/loop'
import { SessionManager } from '../session/session-manager'
import { saveConfig } from '../config/persist'
import { buildSettingsPayload } from '../config/env-provider-fallback'
import { MCP_MARKETPLACE, resolveMarketplaceConfig } from '../config/mcp-marketplace.js'
import { validateMcpServers } from '../config/mcp-config.js'
import type { catbuddyConfig, McpServerConfig } from "@catbuddy/shared"
import type { GatewayDesktopClient } from '@catbuddy/gateway-sdk-desktop'

export function registerIpcHandlers(
  agentLoop: AgentLoop,
  sessions: SessionManager,
  config: catbuddyConfig,
  configFile: string,
  getGatewayClient: () => GatewayDesktopClient | null = () => null,
) {
  const persistConfig = () => saveConfig(configFile, config)

  const toSessionKey = (chatId?: string): string => {
    if (!chatId?.trim()) return 'desktop:main'
    const raw = chatId.trim()
    return raw.startsWith('desktop:') ? raw : `desktop:${raw}`
  }

  const bareChatId = (sessionKey: string): string => {
    const idx = sessionKey.indexOf(':')
    return idx === -1 ? sessionKey : sessionKey.slice(idx + 1)
  }

  // ═══ Agent ═══
  // IPC 消息 → bus.inbound → run() → _dispatch() → bus.outbound → DesktopChannel → 前端
  ipcMain.handle('agent:send', async (_event, { chatId, content, media }: { chatId?: string; content: string; media?: string[] }) => {
    const sessionKey = toSessionKey(chatId)
    const bus = agentLoop.bus;
    if (!bus) throw new Error("AgentLoop must be initialized with a MessageBus");
    bus.publishInbound({
      channel: 'desktop',
      senderId: 'user',
      chatId: bareChatId(sessionKey),
      content,
      media: media ?? [],
      timestamp: Date.now(),
      metadata: {},
      sessionKeyOverride: sessionKey,
    });
    sessions.getOrCreate(sessionKey);
    getGatewayClient()?.focusSession(sessionKey);
    if (content.trim()) {
      getGatewayClient()?.publishUiEvent(sessionKey, bareChatId(sessionKey), {
        event: "user_inbound",
        chat_id: bareChatId(sessionKey),
        text: content,
      });
    }
    return { ok: true, sessionKey };
  })

  ipcMain.handle('gateway:status', async () => {
    const gatewayWsClient = getGatewayClient()
    const st = gatewayWsClient?.status;
    return {
      enabled: !!gatewayWsClient,
      connected: st?.connected ?? false,
      deviceId: st?.deviceId,
      accountEmail: st?.accountEmail,
      lastError: st?.lastError,
      subscribedSessions: gatewayWsClient?.subscribedSessionKeys ?? [],
    };
  })

  ipcMain.handle('gateway:subscribe-session', async (_event, { sessionKey, chatId }: { sessionKey?: string; chatId?: string }) => {
    const key = sessionKey?.trim() || toSessionKey(chatId)
    sessions.getOrCreate(key)
    getGatewayClient()?.focusSession(key)
    return { sessionKey: key, subscribed: getGatewayClient()?.subscribedSessionKeys ?? [] }
  })

  ipcMain.handle('gateway:sync-all-sessions', async () => {
    const list = await sessions.list()
    const keys = list.map((row) => row.key)
    getGatewayClient()?.syncSessions(keys)
    return { keys, subscribed: getGatewayClient()?.subscribedSessionKeys ?? [] }
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
  ipcMain.handle('session:delete', async (_event, { key }: { key: string }) => {
    const sessionKey = String(key || '').trim()
    const ok = sessions.delete(sessionKey)
    getGatewayClient()?.publishSessionDelete(sessionKey)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('session:deleted', { sessionKey })
    }
    return ok
  })
  ipcMain.handle('session:clear', async (_event, { key }: { key: string }) => sessions.clear(key))
  ipcMain.handle('session:new', async () => {
    const key = `desktop:${Date.now()}`
    sessions.getOrCreate(key)
    getGatewayClient()?.focusSession(key)
    return { key }
  })

  // ═══ Config ═══
  ipcMain.handle('config:get', async () => config)
  ipcMain.handle('settings:get', async () => buildSettingsPayload(config))
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

    if (path === 'agents.defaults.disabledSkills' && Array.isArray(value)) {
      agentLoop.setDisabledSkills(value as string[])
    }

    // Provider API key 变更 → 重建 fallback provider
    if (path.startsWith('providers.') && path.endsWith('.apiKey')) {
      try {
        const { createProvider } = await import('../providers/factory.js')
        const newProvider = createProvider(config)
        agentLoop.setProvider(newProvider)
        const agentLoop2: any = agentLoop
        if (agentLoop2._provider_snapshot_loader) agentLoop2._provider_signature = null
      } catch (err: any) {
        console.error('[config] Failed to reload provider:', err.message)
        throw err
      }
    }

    if (path === 'tools.mcpServers') {
      agentLoop.mcpManager?.updateServers(value as Record<string, McpServerConfig> | undefined)
      await agentLoop.mcpManager?.reload()
    }

    persistConfig()
  })

  ipcMain.handle('config:list-models', async () => {
    const presets = config.modelPresets ?? {}
    return Object.values(presets)
  })

  ipcMain.handle('config:set-model', async (_event, { presetName }: { presetName: string }) => {
    agentLoop.setModelPreset(presetName)
    persistConfig()
  })

  // ═══ MCP ═══
  const mapMcpServersForUi = (
    servers: Record<string, import('@catbuddy/shared').McpServerConfig>,
  ) => {
    const status = agentLoop.getMcpServerStatus()
    const statusMap = new Map(status.map((s) => [s.name, s]))
    return Object.entries(servers).map(([name, serverConfig]) => {
      const st = statusMap.get(name)
      return {
        name,
        config: serverConfig,
        connected: st?.connected ?? false,
        toolCount: st?.toolCount ?? 0,
        lastError: st?.lastError,
      }
    })
  }

  ipcMain.handle('mcp:get', async () => ({
    servers: mapMcpServersForUi(config.tools?.mcpServers ?? {}),
  }))

  ipcMain.handle('mcp:update-and-reload', async (_event, { servers }: { servers: unknown }) => {
    const validated = validateMcpServers(servers)
    if (!config.tools) {
      config.tools = {
        restrictToWorkspace: false,
        exec: { enable: true },
        web: { enable: true },
        my: { enable: false, allowSet: false },
        imageGeneration: { enable: false },
      }
    }
    config.tools.mcpServers = Object.keys(validated).length > 0 ? validated : undefined
    const message = await agentLoop.setMcpServers(config.tools.mcpServers)
    persistConfig()
    return {
      message,
      servers: mapMcpServersForUi(config.tools.mcpServers ?? {}),
    }
  })

  ipcMain.handle('mcp:marketplace-list', async () => MCP_MARKETPLACE)

  ipcMain.handle('mcp:marketplace-add', async (_event, { id }: { id: string }) => {
    const entry = MCP_MARKETPLACE.find((item) => item.id === id)
    if (!entry) throw new Error(`Unknown marketplace entry: ${id}`)
    if (entry.pasteOnly) {
      throw new Error(
        entry.setupNote
        ?? 'This MCP uses remote HTTP transport. Copy the config template and paste it below.',
      )
    }
    if (Object.keys(entry.config).length === 0) {
      throw new Error('No installable config for this marketplace entry.')
    }
    const resolved = resolveMarketplaceConfig(entry.config)
    const existing = config.tools?.mcpServers ?? {}
    const merged = { ...existing, ...resolved }
    if (!config.tools) {
      config.tools = {
        restrictToWorkspace: false,
        exec: { enable: true },
        web: { enable: true },
        my: { enable: false, allowSet: false },
        imageGeneration: { enable: false },
      }
    }
    config.tools.mcpServers = merged
    const message = await agentLoop.setMcpServers(merged)
    persistConfig()
    return {
      message,
      servers: mapMcpServersForUi(merged),
    }
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

  ipcMain.handle(
    'workspace:open-file',
    async (
      _event,
      { path: filePath, absolute_path }: { path: string; absolute_path?: string },
    ) => {
      const workspace = agentLoop.workspace
      const candidates: string[] = []
      if (absolute_path?.trim()) {
        candidates.push(path.resolve(absolute_path.trim()))
      }
      const rel = (filePath ?? '').trim()
      if (rel) {
        candidates.push(
          path.isAbsolute(rel) ? path.resolve(rel) : path.resolve(workspace, rel),
        )
      }
      const target = candidates.find((p) => fs.existsSync(p))
      if (!target) {
        return { ok: false as const, error: 'file_not_found' }
      }
      const err = await shell.openPath(target)
      if (!err) return { ok: true as const, path: target }
      shell.showItemInFolder(target)
      return { ok: false as const, error: err, path: target }
    },
  )

  // ═══ Skills ═══
  ipcMain.handle('skills:list', async () => agentLoop.listSkills())
  ipcMain.handle('skills:toggle', async (_event, { name, enabled }: { name: string; enabled: boolean }) => {
    const disabled = agentLoop.toggleSkill(name, enabled)
    config.agents.defaults.disabledSkills = disabled
    persistConfig()
  })

  // ═══ Restart ═══
  ipcMain.handle('app:restart', async () => {
    console.log('[main] Restarting app...')
    app.relaunch()
    app.exit(0)
  })

  // ═══ Channels ═══
  ipcMain.handle('channels:status', async () => {
    const gatewayWsClient = getGatewayClient()
    return {
      desktop: { enabled: true, running: true },
      gateway: {
        enabled: !!gatewayWsClient,
        running: gatewayWsClient?.status.connected ?? false,
      },
    }
  })
}
