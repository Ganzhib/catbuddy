import { ApiError } from './ipc-api'

export function requireIpcBridge(): NonNullable<Window['catbuddy']> {
  const api = window.catbuddy
  if (!api) {
    throw new ApiError(503, 'IPC bridge not available')
  }
  return api
}
