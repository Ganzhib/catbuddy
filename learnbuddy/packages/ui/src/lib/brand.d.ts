export { BRAND_PREFIX, brandFilename } from "@learnbuddy/shared/brand";

export function brandPublicDir(): string;
export const BRAND_PUBLIC_DIR: string;
export function brandPublicUrl(name: string): string;
export const brandAssets: {
  readonly logoPng: string;
  readonly logoWebp: string;
  readonly favicon32: string;
  readonly icon: string;
  readonly appleTouch: string;
};
