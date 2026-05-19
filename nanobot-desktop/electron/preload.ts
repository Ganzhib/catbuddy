/**
 * Preload script — contextBridge API
 */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// ═══ IPC channel 名称常量 ═══
const IPC = {
  AGENT_SEND: 'agent:send',
  AGENT_STOP: 'agent:stop',
  AGENT_STATUS: 'agent:status',
  STREAM_DELTA: 'agent:stream-delta',
  STREAM_END: 'agent:stream-end',
  REASONING_DELTA: 'agent:reasoning-delta',
  REASONING_END: 'agent:reasoning-end',
  TOOL_PROGRESS: 'agent:tool-progress',
  RETRY_WAIT: 'agent:retry-wait',
  TURN_COMPLETE: 'agent:turn-complete',
  SESSION_LIST: 'session:list',
  SESSION_GET: 'session:get',
  SESSION_DELETE: 'session:delete',
  SESSION_CLEAR: 'session:clear',
  SESSION_NEW: 'session:new',
  CONFIG_GET: 'config:get',
  CONFIG_UPDATE: 'config:update',
  CONFIG_LIST_MODELS: 'config:list-models',
  CONFIG_SET_MODEL: 'config:set-model',
  WORKSPACE_SELECT: 'workspace:select',
  WORKSPACE_GET: 'workspace:get',
  SKILLS_LIST: 'skills:list',
  SKILLS_TOGGLE: 'skills:toggle',
  CHANNELS_STATUS: 'channels:status',
} as const

const api: NanobotAPI = {
  // ── Agent ──
  sendMessage: (content, media) => ipcRenderer.invoke(IPC.AGENT_SEND, { content, media }),
  stopAgent: (sessionKey) => ipcRenderer.invoke(IPC.AGENT_STOP, { sessionKey }),
  getStatus: () => ipcRenderer.invoke(IPC.AGENT_STATUS),

  // ── Stream events (Main → Renderer push) ──
  onStreamDelta: (cb) => {
    const h = (_: IpcRendererEvent, d: any) => cb(d)
    ipcRenderer.on(IPC.STREAM_DELTA, h)
    return () => ipcRenderer.removeListener(IPC.STREAM_DELTA, h)
  },
  onStreamEnd: (cb) => {
    const h = (_: IpcRendererEvent, d: any) => cb(d)
    ipcRenderer.on(IPC.STREAM_END, h)
    return () => ipcRenderer.removeListener(IPC.STREAM_END, h)
  },
  onReasoningDelta: (cb) => {
    const h = (_: IpcRendererEvent, d: any) => cb(d)
    ipcRenderer.on(IPC.REASONING_DELTA, h)
    return () => ipcRenderer.removeListener(IPC.REASONING_DELTA, h)
  },
  onReasoningEnd: (cb) => {
    const h = () => cb()
    ipcRenderer.on(IPC.REASONING_END, h)
    return () => ipcRenderer.removeListener(IPC.REASONING_END, h)
  },
  onToolProgress: (cb) => {
    const h = (_: IpcRendererEvent, d: any) => cb(d)
    ipcRenderer.on(IPC.TOOL_PROGRESS, h)
    return () => ipcRenderer.removeListener(IPC.TOOL_PROGRESS, h)
  },
  onRetryWait: (cb) => {
    const h = (_: IpcRendererEvent, d: any) => cb(d)
    ipcRenderer.on(IPC.RETRY_WAIT, h)
    return () => ipcRenderer.removeListener(IPC.RETRY_WAIT, h)
  },
  onTurnComplete: (cb) => {
    const h = (_: IpcRendererEvent, d: any) => cb(d)
    ipcRenderer.on(IPC.TURN_COMPLETE, h)
    return () => ipcRenderer.removeListener(IPC.TURN_COMPLETE, h)
  },

  // ── Session ──
  listSessions: () => ipcRenderer.invoke(IPC.SESSION_LIST),
  getSession: (key) => ipcRenderer.invoke(IPC.SESSION_GET, { key }),
  deleteSession: (key) => ipcRenderer.invoke(IPC.SESSION_DELETE, { key }),
  clearSession: (key) => ipcRenderer.invoke(IPC.SESSION_CLEAR, { key }),
  newSession: () => ipcRenderer.invoke(IPC.SESSION_NEW),

  // ── Config ──
  getConfig: () => ipcRenderer.invoke(IPC.CONFIG_GET),
  updateConfig: (path, value) => ipcRenderer.invoke(IPC.CONFIG_UPDATE, { path, value }),
  listModels: () => ipcRenderer.invoke(IPC.CONFIG_LIST_MODELS),
  setModel: (name) => ipcRenderer.invoke(IPC.CONFIG_SET_MODEL, { presetName: name }),

  // ── Workspace ──
  selectWorkspace: () => ipcRenderer.invoke(IPC.WORKSPACE_SELECT),
  getWorkspace: () => ipcRenderer.invoke(IPC.WORKSPACE_GET),

  // ── Skills ──
  listSkills: () => ipcRenderer.invoke(IPC.SKILLS_LIST),
  toggleSkill: (name, enabled) => ipcRenderer.invoke(IPC.SKILLS_TOGGLE, { name, enabled }),

  // ── Channels ──
  getChannelsStatus: () => ipcRenderer.invoke(IPC.CHANNELS_STATUS),
}

contextBridge.exposeInMainWorld('nanobot', api)
