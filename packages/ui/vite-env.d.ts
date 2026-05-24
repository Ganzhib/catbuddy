interface ImportMetaEnv {
  readonly DEV?: boolean
  readonly VITE_CATBUDDY_DEV_MODE?: string
  readonly VITE_USE_GATEWAY?: string
  readonly VITE_GATEWAY_HTTP_URL?: string
  readonly VITE_GATEWAY_URL?: string
  readonly VITE_GATEWAY_HTTP_BASE?: string
  readonly VITE_GATEWAY_WS_URL?: string
  readonly VITE_GATEWAY_WEB_TOKEN?: string
  readonly VITE_GATEWAY_DEVICE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
