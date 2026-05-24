/** Single source of truth for public/brand asset paths (used by app + scripts). */
export const BRAND_PREFIX = 'catbuddy'
export const BRAND_PUBLIC_DIR = '/brand'

/** @param {string} name e.g. "logo.png", "favicon_32.png" */
export function brandFilename(name) {
  return `${BRAND_PREFIX}_${name}`
}

/** @param {string} name */
export function brandPublicUrl(name) {
  return `${BRAND_PUBLIC_DIR}/${brandFilename(name)}`
}

export const brandAssets = {
  logoPng: brandPublicUrl('logo.png'),
  logoWebp: brandPublicUrl('logo.webp'),
  favicon32: brandPublicUrl('favicon_32.png'),
  icon: brandPublicUrl('icon.png'),
  appleTouch: brandPublicUrl('apple_touch.png'),
}

export const brandSource = {
  icon: 'public/brand/source/icon.png',
  logo: 'public/brand/source/logo.png',
  iconOriginal: 'public/brand/source/icon.original.png',
}

export const electronIcon = 'apps/desktop/src/main/assets/icon.png'
