import { brandFilename as coreBrandFilename } from "@learnbuddy/shared/brand";

export { BRAND_PREFIX, brandFilename } from "@learnbuddy/shared/brand";

/** Vite `base`: `./` for Electron file://, `/` for web. */
function viteBase(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) {
    const b = import.meta.env.BASE_URL;
    return b.endsWith("/") ? b : `${b}/`;
  }
  return "/";
}

/** Public URL prefix for brand assets (no trailing slash). */
export function brandPublicDir(): string {
  const base = viteBase();
  if (base === "/") return "/brand";
  return `${base}brand`.replace(/\/{2,}/g, "/");
}

export const BRAND_PUBLIC_DIR = brandPublicDir();

export function brandPublicUrl(name: string): string {
  const file = coreBrandFilename(name);
  const dir = brandPublicDir();
  if (dir.startsWith("/")) return `${dir}/${file}`;
  return `${dir}/${file}`.replace(/\/{2,}/g, "/");
}

export const brandAssets = {
  logoPng: brandPublicUrl("logo.png"),
  logoWebp: brandPublicUrl("logo.webp"),
  favicon32: brandPublicUrl("favicon_32.png"),
  icon: brandPublicUrl("icon.png"),
  appleTouch: brandPublicUrl("apple_touch.png"),
} as const;
