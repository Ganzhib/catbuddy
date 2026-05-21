declare module '@shared/brand.mjs' {
  export const BRAND_PREFIX: 'learnbuddy'
  export const BRAND_PUBLIC_DIR: '/brand'

  export function brandFilename(name: string): string
  export function brandPublicUrl(name: string): string

  export const brandAssets: {
    readonly logoPng: string
    readonly logoWebp: string
    readonly favicon32: string
    readonly icon: string
    readonly appleTouch: string
  }

  export const brandSource: {
    readonly icon: string
    readonly logo: string
    readonly iconOriginal: string
  }

  export const electronIcon: string
}
