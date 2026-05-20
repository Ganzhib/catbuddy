/**
 * Preload script — pure CommonJS, NO TypeScript compilation
 * 直接放在项目根目录，.cjs 扩展名强制 CJS 模式
 */

import { IPC } from './ipc'
const { contextBridge, ipcRenderer } = require('electron')


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
  onRetryWait: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on(IPC.RETRY_WAIT, h); return () => ipcRenderer.removeListener(IPC.RETRY_WAIT, h) },
  onTurnComplete: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on(IPC.TURN_COMPLETE, h); return () => ipcRenderer.removeListener(IPC.TURN_COMPLETE, h) },
  onSystemMessage: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on(IPC.SYSTEM_MESSAGE, h); return () => ipcRenderer.removeListener(IPC.SYSTEM_MESSAGE, h) },

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

  // ── Restart ──
  restartApp: () => ipcRenderer.invoke('app:restart'),

  // ── Channels ──
  getChannelsStatus: () => ipcRenderer.invoke(IPC.CHANNELS_STATUS),
}

contextBridge.exposeInMainWorld('nanobot', api)
