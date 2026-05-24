const { ipcRenderer } = require('electron')
const IPC = require('./ipc-channels.cjs')

function subscribe(channel, cb) {
  const handler = (_, data) => cb(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

function subscribeVoid(channel, cb) {
  const handler = () => cb()
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

/** Renderer-facing API exposed via contextBridge. */
function createCatbuddyApi() {
  return {
    sendMessage: (chatId, content, media) =>
      ipcRenderer.invoke(IPC.AGENT_SEND, { chatId, content, media }),
    stopAgent: (sessionKey) => ipcRenderer.invoke(IPC.AGENT_STOP, { sessionKey }),
    getStatus: () => ipcRenderer.invoke(IPC.AGENT_STATUS),

    onStreamDelta: (cb) => subscribe(IPC.STREAM_DELTA, cb),
    onStreamEnd: (cb) => subscribe(IPC.STREAM_END, cb),
    onReasoningDelta: (cb) => subscribe(IPC.REASONING_DELTA, cb),
    onReasoningEnd: (cb) => subscribeVoid(IPC.REASONING_END, cb),
    onToolProgress: (cb) => subscribe(IPC.TOOL_PROGRESS, cb),
    onFileEdit: (cb) => subscribe(IPC.FILE_EDIT, cb),
    onRetryWait: (cb) => subscribe(IPC.RETRY_WAIT, cb),
    onTurnComplete: (cb) => subscribe(IPC.TURN_COMPLETE, cb),
    onSystemMessage: (cb) => subscribe(IPC.SYSTEM_MESSAGE, cb),
    onAssistantMessage: (cb) => subscribe(IPC.ASSISTANT_MESSAGE, cb),
    onGatewayInbound: (cb) => subscribe(IPC.GATEWAY_INBOUND, cb),
    onGatewayConnectionChanged: (cb) => subscribe('gateway:connection-changed', cb),

    listSessions: () => ipcRenderer.invoke(IPC.SESSION_LIST),
    getSession: (key) => ipcRenderer.invoke(IPC.SESSION_GET, { key }),
    deleteSession: (key) => ipcRenderer.invoke(IPC.SESSION_DELETE, { key }),
    clearSession: (key) => ipcRenderer.invoke(IPC.SESSION_CLEAR, { key }),
    newSession: () => ipcRenderer.invoke(IPC.SESSION_NEW),
    onSessionCreated: (cb) => subscribe(IPC.SESSION_CREATED, cb),

    getConfig: () => ipcRenderer.invoke(IPC.CONFIG_GET),
    updateConfig: (path, value) => ipcRenderer.invoke(IPC.CONFIG_UPDATE, { path, value }),
    listModels: () => ipcRenderer.invoke(IPC.CONFIG_LIST_MODELS),
    setModel: (name) => ipcRenderer.invoke(IPC.CONFIG_SET_MODEL, { presetName: name }),

    selectWorkspace: () => ipcRenderer.invoke(IPC.WORKSPACE_SELECT),
    getWorkspace: () => ipcRenderer.invoke(IPC.WORKSPACE_GET),

    listSkills: () => ipcRenderer.invoke(IPC.SKILLS_LIST),
    toggleSkill: (name, enabled) => ipcRenderer.invoke(IPC.SKILLS_TOGGLE, { name, enabled }),

    restartApp: () => ipcRenderer.invoke('app:restart'),

    getChannelsStatus: () => ipcRenderer.invoke(IPC.CHANNELS_STATUS),

    getGatewayStatus: () => ipcRenderer.invoke(IPC.GATEWAY_STATUS),
    gatewaySubscribeSession: (payload) => ipcRenderer.invoke(IPC.GATEWAY_SUBSCRIBE, payload),
    gatewaySyncAllSessions: () => ipcRenderer.invoke(IPC.GATEWAY_SYNC_ALL),
    setGatewayAccountEmail: (payload) =>
      ipcRenderer.invoke(IPC.GATEWAY_SET_ACCOUNT_EMAIL, payload),

    getGatewayRemoteEnabled: () => ipcRenderer.invoke('gateway:get-remote-enabled'),
    setGatewayRemoteEnabled: (enabled) =>
      ipcRenderer.invoke('gateway:set-remote-enabled', { enabled }),
    getGatewayConnectionSettings: () =>
      ipcRenderer.invoke('gateway:get-connection-settings'),
    setGatewayConnectionSettings: (payload) =>
      ipcRenderer.invoke('gateway:set-connection-settings', payload),
  }
}

module.exports = { createCatbuddyApi }
