const BLOCKED_INVOKE_CHANNELS = new Set([
  'shell:openExternal',
  'fs:readFile',
  'fs:writeFile',
])

/** Reject dangerous invoke channels if accidentally wired in preload. */
function assertSafeInvokeChannel(channel) {
  if (typeof channel !== 'string' || !channel.trim()) {
    throw new Error('Invalid IPC channel')
  }
  if (BLOCKED_INVOKE_CHANNELS.has(channel)) {
    throw new Error(`Blocked IPC channel: ${channel}`)
  }
}

/** Only allow known learnbuddy API keys on the exposed bridge object. */
function assertSafeBridgeApi(api) {
  if (!api || typeof api !== 'object') {
    throw new Error('Preload API must be a plain object')
  }
  for (const key of Object.keys(api)) {
    if (key.startsWith('__') || key === 'constructor' || key === 'prototype') {
      throw new Error(`Unsafe bridge key: ${key}`)
    }
  }
}

module.exports = { assertSafeInvokeChannel, assertSafeBridgeApi }
