/// <reference types="vite/client" />
/// <reference path="../../packages/platform/src/preload-api.d.ts" />

interface ImportMetaEnv {
  readonly VITE_USE_GATEWAY?: string
  readonly VITE_GATEWAY_HTTP_URL?: string
  readonly VITE_GATEWAY_URL?: string
}
