# Brand source assets

Put **master** images here; run `pnpm run brand:generate` to regenerate everything the app uses.

## Required

| File | Spec |
|------|------|
| `icon.png` | Square app icon, **≥512×512** (1024×1024 recommended). Photo with background? Run cutout first (below). |

### Remove background (photo → transparent cat)

```bash
pnpm run brand:cutout
```

Uses local AI (`@imgly/background-removal-node`), backs up to `icon.original.png`, overwrites `icon.png` with transparent PNG, then:

```bash
pnpm run brand:generate
```

## Optional

| File | Spec |
|------|------|
| `logo.png` | Pre-made horizontal logo (only if you already have final artwork) |

**If `logo.png` is missing**, `pnpm run brand:generate` **composes** the sidebar logo from `icon.png` + the word `learnbuddy` (orange `learn` + brown `buddy`), so you are not stuck with old `nanobot` text baked into PNGs.

```bash
pnpm run brand:generate -- --logo-text learnbuddy --logo-split 5
```

App code imports paths from `shared/brand.mjs` (`src/lib/brand.ts`, `BrandLogo`, `BrandMark`).

SVG masters (`icon.svg`, `logo.svg`) work via `--icon` / `--logo`.

## Generated outputs

| Output | Use |
|--------|-----|
| `learnbuddy_favicon_32.png` | Browser tab (`index.html`) |
| `learnbuddy_icon.png` | Secondary favicon |
| `learnbuddy_apple_touch.png` | iOS home screen |
| `learnbuddy_logo.png` / `.webp` | Sidebar (`Sidebar.tsx`) |
| `electron/assets/icon.png` | Electron window + `electron-builder` (512×512) |

## Commands

```bash
pnpm run brand:generate

# Custom masters
pnpm run brand:generate -- --icon ./my-icon.png --logo ./my-logo.png
```

After renaming the product, only the **output filenames** use the `learnbuddy_` prefix; you can keep designing in any tool and drop masters into `source/`.
