/**
 * Preload script — pure CommonJS, NO TypeScript compilation
 * 直接放在项目根目录，.cjs 扩展名强制 CJS 模式
 */
const { contextBridge, ipcRenderer } = require('electron')

const IPC = {
  AGENT_SEND: 'agent:send',
  AGENT_STOP: 'agent:stop',
  AGENT_STATUS: 'agent:status',
  STREAM_DELTA: 'agent:stream-delta',
  STREAM_END: 'agent:stream-end',
  REASONING_DELTA: 'agent:reasoning-delta',
  REASONING_END: 'agent:reasoning-end',
  TOOL_PROGRESS: 'agent:tool-progress',
  FILE_EDIT: 'agent:file-edit',
  RETRY_WAIT: 'agent:retry-wait',
  TURN_COMPLETE: 'agent:turn-complete',
  SYSTEM_MESSAGE: 'agent:system-message',
  ASSISTANT_MESSAGE: 'agent:assistant-message',
  RELAY_INBOUND: 'agent:relay-inbound',
  SESSION_LIST: 'session:list',
  SESSION_GET: 'session:get',
  SESSION_DELETE: 'session:delete',
  SESSION_CLEAR: 'session:clear',
  SESSION_NEW: 'session:new',
  SESSION_CREATED: 'session:created',
  CONFIG_GET: 'config:get',
  CONFIG_UPDATE: 'config:update',
  CONFIG_LIST_MODELS: 'config:list-models',
  CONFIG_SET_MODEL: 'config:set-model',
  WORKSPACE_SELECT: 'workspace:select',
  WORKSPACE_GET: 'workspace:get',
  SKILLS_LIST: 'skills:list',
  SKILLS_TOGGLE: 'skills:toggle',
  CHANNELS_STATUS: 'channels:status',
  RELAY_STATUS: 'relay:status',
  RELAY_SUBSCRIBE: 'relay:subscribe-session',
  RELAY_SYNC_ALL: 'relay:sync-all-sessions',
}

const api = {
  // ── Agent ──
  sendMessage: (chatId, content, media) => ipcRenderer.invoke(IPC.AGENT_SEND, { chatId, content, media }),
  stopAgent: (sessionKey) => ipcRenderer.invoke(IPC.AGENT_STOP, { sessionKey }),
  getStatus: () => ipcRenderer.invoke(IPC.AGENT_STATUS),

  // ── Stream events ──
  onStreamDelta: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on(IPC.STREAM_DELTA, h); return () => ipcRenderer.removeListener(IPC.STREAM_DELTA, h) },
  onStreamEnd: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on(IPC.STREAM_END, h); return () => ipcRenderer.removeListener(IPC.STREAM_END, h) },
  onReasoningDelta: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on(IPC.REASONING_DELTA, h); return () => ipcRenderer.removeListener(IPC.REASONING_DELTA, h) },
  onReasoningEnd: (cb) => { const h = () => cb(); ipcRenderer.on(IPC.REASONING_END, h); return () => ipcRenderer.removeListener(IPC.REASONING_END, h) },
  onToolProgress: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on(IPC.TOOL_PROGRESS, h); return () => ipcRenderer.removeListener(IPC.TOOL_PROGRESS, h) },
  onFileEdit: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on(IPC.FILE_EDIT, h); return () => ipcRenderer.removeListener(IPC.FILE_EDIT, h) },
  onRetryWait: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on(IPC.RETRY_WAIT, h); return () => ipcRenderer.removeListener(IPC.RETRY_WAIT, h) },
  onTurnComplete: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on(IPC.TURN_COMPLETE, h); return () => ipcRenderer.removeListener(IPC.TURN_COMPLETE, h) },
  onSystemMessage: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on(IPC.SYSTEM_MESSAGE, h); return () => ipcRenderer.removeListener(IPC.SYSTEM_MESSAGE, h) },
  onAssistantMessage: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on(IPC.ASSISTANT_MESSAGE, h); return () => ipcRenderer.removeListener(IPC.ASSISTANT_MESSAGE, h) },
  onRelayInbound: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on(IPC.RELAY_INBOUND, h); return () => ipcRenderer.removeListener(IPC.RELAY_INBOUND, h) },

  // ── Session ──
  listSessions: () => ipcRenderer.invoke(IPC.SESSION_LIST),
  getSession: (key) => ipcRenderer.invoke(IPC.SESSION_GET, { key }),
  deleteSession: (key) => ipcRenderer.invoke(IPC.SESSION_DELETE, { key }),
  clearSession: (key) => ipcRenderer.invoke(IPC.SESSION_CLEAR, { key }),
  newSession: () => ipcRenderer.invoke(IPC.SESSION_NEW),
  onSessionCreated: (cb) => {
    const h = (_, d) => cb(d)
    ipcRenderer.on(IPC.SESSION_CREATED, h)
    return () => ipcRenderer.removeListener(IPC.SESSION_CREATED, h)
  },

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

  // ── Restart ──
  restartApp: () => ipcRenderer.invoke('app:restart'),

  // ── Channels ──
  getChannelsStatus: () => ipcRenderer.invoke(IPC.CHANNELS_STATUS),

  getRelayStatus: () => ipcRenderer.invoke(IPC.RELAY_STATUS),
  relaySubscribeSession: (payload) => ipcRenderer.invoke(IPC.RELAY_SUBSCRIBE, payload),
  relaySyncAllSessions: () => ipcRenderer.invoke(IPC.RELAY_SYNC_ALL),

  getGatewayRemoteEnabled: () => ipcRenderer.invoke('gateway:get-remote-enabled'),
  setGatewayRemoteEnabled: (enabled) =>
    ipcRenderer.invoke('gateway:set-remote-enabled', { enabled }),
}

contextBridge.exposeInMainWorld('learnbuddy', api)
