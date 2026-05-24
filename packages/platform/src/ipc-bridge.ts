import { ApiError } from './ipc-api'

export function requireIpcBridge(): NonNullable<Window['learnbuddy']> {
  const api = window.learnbuddy
  if (!api) {
    throw new ApiError(503, 'IPC bridge not available')
  }
  return api
}
