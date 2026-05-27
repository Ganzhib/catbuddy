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
import { SKILL_MARKETPLACE } from '../config/skill-marketplace.js'
import { installBuiltinSkillToWorkspace } from '../agent/skill-install.js'
import { applySkillToggle } from '../agent/skill.js'
import { validateMcpServers } from '../config/mcp-config.js'
import { getCatbuddyDirFromConfigFile, getWorkspaceProjectInfo } from '../services/workspace-project.js'
import {
  applyProjectAnchor,
  getHomeCatbuddyDir,
  type DesktopRuntimeRefs,
} from '../services/workspace-anchor.js'
import {
  createWorkspaceFolderFromPath,
  getActiveWorkspaceFolderId,
  getWorkspaceFolderById,
  listWorkspaceFolders,
  removeWorkspaceFolder,
  setActiveWorkspaceFolderId,
} from '../services/workspace-folders.js'
import type { catbuddyConfig, McpServerConfig, WorkspaceFolder } from "@catbuddy/shared"
import { DESKTOP_BUILTIN_SLASH_COMMANDS } from "@catbuddy/shared"
import type { GatewayDesktopClient } from '@catbuddy/gateway-sdk-desktop'
import {
  updateGatewayRuntimeRefs,
  type GatewayRemoteState,
} from '../services/gateway-remote.js'
export interface RegisterIpcHandlersOpts {
  getGatewayClient?: () => GatewayDesktopClient | null
  gatewayState?: GatewayRemoteState
}

export function registerIpcHandlers(
  runtime: DesktopRuntimeRefs,
  opts: RegisterIpcHandlersOpts = {},
) {
  const getGatewayClient = opts.getGatewayClient ?? (() => null)
  const gatewayState = opts.gatewayState
  const { agentLoop } = runtime
  const persistConfig = () => saveConfig(runtime.configFile, runtime.config)
  const homeCatbuddyDir = () => getHomeCatbuddyDir()

  const anchorToFolder = (folder: WorkspaceFolder | null) => {
    applyProjectAnchor(runtime, folder)
    if (gatewayState) updateGatewayRuntimeRefs(gatewayState, runtime)
  }

  const toSessionKey = (chatId?: string): string => {
    if (!chatId?.trim()) return 'desktop:main'
    const raw = chatId.trim()
    return raw.startsWith('desktop:') ? raw : `desktop:${raw}`
  }

  const bareChatId = (sessionKey: string): string => {
    const idx = sessionKey.indexOf(':')
    return idx === -1 ? sessionKey : sessionKey.slice(idx + 1)
  }

  const ensureSessionWorkspaceFolder = (sessionKey: string, preferredFolderId?: string | null) => {
    runtime.sessions.getOrCreate(sessionKey)
    const existing = runtime.sessions.getMetadataValue<string>(sessionKey, 'workspaceFolderId')
    if (existing) return existing
    const active = getActiveWorkspaceFolderId(homeCatbuddyDir())
    const folderId = preferredFolderId?.trim() || active
    if (folderId) {
      runtime.sessions.setMetadata(sessionKey, { workspaceFolderId: folderId })
      return folderId
    }
    return null
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
    runtime.sessions.getOrCreate(sessionKey);
    ensureSessionWorkspaceFolder(sessionKey);
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

  ipcMain.handle('gateway:subscribe-session', async (_event, { sessionKey, chatId, workspaceFolderId }: { sessionKey?: string; chatId?: string; workspaceFolderId?: string | null }) => {
    const key = sessionKey?.trim() || toSessionKey(chatId)
    runtime.sessions.getOrCreate(key)
    ensureSessionWorkspaceFolder(key, workspaceFolderId)
    getGatewayClient()?.focusSession(key)
    return { sessionKey: key, subscribed: getGatewayClient()?.subscribedSessionKeys ?? [] }
  })

  ipcMain.handle('gateway:sync-all-sessions', async () => {
    const list = await runtime.sessions.list()
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
  ipcMain.handle('session:list', async () => runtime.sessions.list())
  ipcMain.handle('session:get', async (_event, { key }: { key: string }) => runtime.sessions.getDetail(key))
  ipcMain.handle('session:delete', async (_event, { key }: { key: string }) => {
    const sessionKey = String(key || '').trim()
    const ok = runtime.sessions.delete(sessionKey)
    getGatewayClient()?.publishSessionDelete(sessionKey)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('session:deleted', { sessionKey })
    }
    return ok
  })
  ipcMain.handle('session:clear', async (_event, { key }: { key: string }) => runtime.sessions.clear(key))
  ipcMain.handle('session:new', async (_event, { workspaceFolderId }: { workspaceFolderId?: string } = {}) => {
    const home = homeCatbuddyDir()
    const folderId = workspaceFolderId ?? getActiveWorkspaceFolderId(home)
    if (folderId) {
      const active = getActiveWorkspaceFolderId(home)
      if (folderId !== active) {
        setActiveWorkspaceFolderId(home, folderId)
        const folder = getWorkspaceFolderById(home, folderId)
        if (folder) anchorToFolder(folder)
      }
    }

    const key = `desktop:${Date.now()}`
    runtime.sessions.getOrCreate(key)
    if (folderId) {
      runtime.sessions.setMetadata(key, { workspaceFolderId: folderId })
    }
    getGatewayClient()?.focusSession(key)
    return { key }
  })

  // ═══ Config ═══
  ipcMain.handle('config:get', async () => runtime.config)
  ipcMain.handle('settings:get', async () => buildSettingsPayload(runtime.config))
  ipcMain.handle('config:update', async (_event, { path, value }: { path: string; value: unknown }) => {
    const keys = path.split('.')
    let obj: any = runtime.config
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
        const newProvider = createProvider(runtime.config)
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
    const presets = runtime.config.modelPresets ?? {}
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
    servers: mapMcpServersForUi(runtime.config.tools?.mcpServers ?? {}),
  }))

  ipcMain.handle('mcp:update-and-reload', async (_event, { servers }: { servers: unknown }) => {
    const validated = validateMcpServers(servers)
    if (!runtime.config.tools) {
      runtime.config.tools = {
        restrictToWorkspace: false,
        exec: { enable: true },
        web: { enable: true },
        my: { enable: false, allowSet: false },
        imageGeneration: { enable: false },
      }
    }
    runtime.config.tools.mcpServers = Object.keys(validated).length > 0 ? validated : undefined
    const message = await agentLoop.setMcpServers(runtime.config.tools.mcpServers)
    persistConfig()
    return {
      message,
      servers: mapMcpServersForUi(runtime.config.tools.mcpServers ?? {}),
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
    const existing = runtime.config.tools?.mcpServers ?? {}
    const merged = { ...existing, ...resolved }
    if (!runtime.config.tools) {
      runtime.config.tools = {
        restrictToWorkspace: false,
        exec: { enable: true },
        web: { enable: true },
        my: { enable: false, allowSet: false },
        imageGeneration: { enable: false },
      }
    }
    runtime.config.tools.mcpServers = merged
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

  ipcMain.handle('workspace:project-info', async () => {
    const {
      getWorkspaceProjectInfo,
    } = await import('../services/workspace-project.js')
    return getWorkspaceProjectInfo(runtime.configFile, agentLoop.workspace)
  })

  ipcMain.handle('workspace:list-entries', async () => {
    const {
      getWorkspaceProjectInfo,
      listProjectRootEntries,
    } = await import('../services/workspace-project.js')
    const info = getWorkspaceProjectInfo(runtime.configFile, agentLoop.workspace)
    return listProjectRootEntries(info.projectRoot)
  })

  ipcMain.handle(
    'workspace:list-children',
    async (_event, { dirPath }: { dirPath: string }) => {
      const {
        getWorkspaceProjectInfo,
        listDirectoryChildren,
      } = await import('../services/workspace-project.js')
      const info = getWorkspaceProjectInfo(runtime.configFile, agentLoop.workspace)
      return listDirectoryChildren(path.resolve(dirPath), info.projectRoot)
    },
  )

  ipcMain.handle('workspace:import-folder', async () => {
    const { dialog } = await import('electron')

    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select folder to add to workspace',
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false as const, cancelled: true }
    }

    const sourcePath = result.filePaths[0]
    const home = homeCatbuddyDir()
    const { folder, created, store } = createWorkspaceFolderFromPath(home, sourcePath)
    anchorToFolder(folder)

    return {
      ok: true as const,
      folder,
      created,
      activeFolderId: store.activeFolderId,
      folders: store.folders,
      anchor: {
        projectRoot: folder.projectRoot,
        catbuddyDir: folder.catbuddyDir,
      },
    }
  })

  ipcMain.handle('workspace-folders:list', async () => listWorkspaceFolders(homeCatbuddyDir()))

  ipcMain.handle(
    'workspace-folders:set-active',
    async (_event, { folderId }: { folderId: string | null }) => {
      const home = homeCatbuddyDir()
      const store = setActiveWorkspaceFolderId(home, folderId)
      const folder = folderId ? getWorkspaceFolderById(home, folderId) : null
      anchorToFolder(folder)
      return store
    },
  )

  ipcMain.handle(
    'workspace-folders:remove',
    async (_event, { folderId }: { folderId: string }) => {
      const home = homeCatbuddyDir()
      const store = removeWorkspaceFolder(home, folderId)
      const nextFolder = store.activeFolderId
        ? getWorkspaceFolderById(home, store.activeFolderId)
        : null
      anchorToFolder(nextFolder)
      return store
    },
  )

  // ═══ Skills ═══
  ipcMain.handle('skills:list', async () => agentLoop.listSkills())
  ipcMain.handle('skills:toggle', async (_event, { name, enabled }: { name: string; enabled: boolean }) => {
    const disabled = agentLoop.toggleSkill(name, enabled)
    runtime.config.agents.defaults.disabledSkills = disabled
    persistConfig()
  })

  ipcMain.handle('skills:marketplace-list', async () => SKILL_MARKETPLACE)

  ipcMain.handle('skills:marketplace-install', async (_event, { id }: { id: string }) => {
    const entry = SKILL_MARKETPLACE.find((item) => item.id === id)
    if (!entry) throw new Error(`Unknown marketplace entry: ${id}`)

    const workspace = agentLoop.workspace
    const { alreadyInstalled } = installBuiltinSkillToWorkspace(entry.skillName, workspace)

    let disabled = runtime.config.agents.defaults.disabledSkills ?? []
    if (disabled.includes(entry.skillName)) {
      disabled = applySkillToggle(disabled, entry.skillName, true)
      runtime.config.agents.defaults.disabledSkills = disabled
      agentLoop.setDisabledSkills(disabled)
      persistConfig()
    }

    const skills = agentLoop.listSkills()
    const message = alreadyInstalled
      ? `「${entry.name}」已在工作区。已启用，发送下一条消息即可使用（无需新开对话或重启）。`
      : `已安装「${entry.name}」并启用。发送下一条消息即可加载到 Agent 上下文（热启动，无需新开对话或重启）。`

    return { message, skills, hotReload: true }
  })

  // ═══ Slash commands (composer palette) ═══
  ipcMain.handle('commands:list', async () => DESKTOP_BUILTIN_SLASH_COMMANDS)

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
