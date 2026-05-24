#!/usr/bin/env node
/**
 * Generate catbuddy brand assets from master images in public/brand/source/.
 *
 * Usage:
 *   pnpm run brand:generate
 *   pnpm run brand:generate -- --icon path/to/icon.png --logo path/to/logo.png
 *   pnpm run brand:generate -- --compose-logo --logo-text catbuddy --logo-split 5
 *
 * Masters (recommended):
 *   public/brand/source/icon.png  — square cat/icon only (≥512×512 ideal)
 *   public/brand/source/logo.png  — optional ready-made horizontal logo
 *
 * Without source/logo.png, logo is composed from icon + brand text.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const requireFromDesktop = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'desktop', 'package.json'),
)
const sharp = requireFromDesktop('sharp')
import {
  BRAND_PREFIX,
  brandAssets,
  brandFilename,
  electronIcon,
} from '../packages/shared/src/brand.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
/** Where Vite/Electron serve brand assets from. */
const BRAND_OUT_DIRS = [
  path.join(ROOT, 'apps/desktop/public/brand'),
  path.join(ROOT, 'apps/web/public/brand'),
]
const SOURCE_DIR = path.join(BRAND_OUT_DIRS[0], 'source')
const ELECTRON_ICON = path.join(ROOT, electronIcon)
const INDEX_HTML = path.join(ROOT, 'apps/desktop/src/renderer/index.html')

const PREFIX = process.env.BRAND_PREFIX || BRAND_PREFIX

/** @type {{ file: string; width: number; height: number; fit?: 'cover' | 'contain' }[]} */
const ICON_VARIANTS = [
  { file: brandFilename('favicon_32.png'), width: 32, height: 32 },
  { file: brandFilename('apple_touch.png'), width: 180, height: 180 },
  { file: brandFilename('icon.png'), width: 73, height: 75, fit: 'contain' },
]

const LOGO_HEIGHT = 75
const LOGO_MAX_WIDTH = 400
const ELECTRON_ICON_SIZE = 512
const WEBP_QUALITY = 86
const LOGO_ICON_GAP = 10
const LOGO_COLOR_A = '#F97316'
const LOGO_COLOR_B = '#9A3412'
const FONT_STACK =
  "'Segoe UI Variable Display', 'Segoe UI', 'Arial Rounded MT Bold', ui-rounded, system-ui, sans-serif"

function parseArgs(argv) {
  const out = {
    icon: null,
    logo: null,
    composeLogo: process.env.BRAND_COMPOSE_LOGO !== '0',
    logoText: process.env.BRAND_LOGO_TEXT || 'catbuddy',
    logoSplit: Number(process.env.BRAND_LOGO_SPLIT || '3'),
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--icon' && argv[i + 1]) out.icon = path.resolve(argv[++i])
    else if (argv[i] === '--logo' && argv[i + 1]) out.logo = path.resolve(argv[++i])
    else if (argv[i] === '--compose-logo') out.composeLogo = true
    else if (argv[i] === '--no-compose-logo') out.composeLogo = false
    else if (argv[i] === '--logo-text' && argv[i + 1]) out.logoText = argv[++i]
    else if (argv[i] === '--logo-split' && argv[i + 1]) out.logoSplit = Number(argv[++i])
    else if (argv[i] === '--help' || argv[i] === '-h') out.help = true
  }
  return out
}

function firstExisting(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p
  }
  return null
}

async function resizeIcon(input, { width, height, fit = 'cover' }) {
  return sharp(input)
    .resize(width, height, {
      fit,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      position: 'centre',
    })
    .png()
    .toBuffer()
}

async function resizeLogo(input) {
  const meta = await sharp(input).metadata()
  const scale = LOGO_HEIGHT / (meta.height || LOGO_HEIGHT)
  let width = Math.round((meta.width || LOGO_MAX_WIDTH) * scale)
  if (width > LOGO_MAX_WIDTH) width = LOGO_MAX_WIDTH
  return sharp(input)
    .resize(width, LOGO_HEIGHT, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()
}

/** Build horizontal logo: icon + two-tone wordmark (no baked legacy text). */
async function composeLogoFromIcon(iconPath, { text, splitAt, colorA, colorB }) {
  const iconBuf = await sharp(iconPath)
    .resize(LOGO_HEIGHT, LOGO_HEIGHT, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
  const { width: iconW = LOGO_HEIGHT } = await sharp(iconBuf).metadata()
  const iconB64 = iconBuf.toString('base64')

  const partA = text.slice(0, splitAt)
  const partB = text.slice(splitAt)
  const fontSize = Math.round(LOGO_HEIGHT * 0.68)
  const textX = iconW + LOGO_ICON_GAP
  const baselineY = Math.round(LOGO_HEIGHT * 0.78)
  const estTextW = Math.round(text.length * fontSize * 0.52)
  const svgWidth = Math.min(LOGO_MAX_WIDTH, textX + estTextW + 12)

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${LOGO_HEIGHT}" viewBox="0 0 ${svgWidth} ${LOGO_HEIGHT}">
  <image href="data:image/png;base64,${iconB64}" x="0" y="0" width="${iconW}" height="${LOGO_HEIGHT}" preserveAspectRatio="xMidYMid meet"/>
  <text x="${textX}" y="${baselineY}" font-family="${FONT_STACK}" font-weight="800" font-size="${fontSize}px" letter-spacing="-0.02em">
    <tspan fill="${colorA}">${escapeXml(partA)}</tspan><tspan fill="${colorB}">${escapeXml(partB)}</tspan>
  </text>
</svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function syncIndexHtml() {
  let html = fs.readFileSync(INDEX_HTML, 'utf-8')
  html = html.replace(
    /<link rel="icon" type="image\/png" sizes="32x32" href="[^"]*" \/>/,
    `<link rel="icon" type="image/png" sizes="32x32" href="${brandAssets.favicon32}" />`,
  )
  html = html.replace(
    /<link rel="icon" type="image\/png" sizes="73x75" href="[^"]*" \/>/,
    `<link rel="icon" type="image/png" sizes="73x75" href="${brandAssets.icon}" />`,
  )
  html = html.replace(
    /<link rel="apple-touch-icon" sizes="180x180" href="[^"]*" \/>/,
    `<link rel="apple-touch-icon" sizes="180x180" href="${brandAssets.appleTouch}" />`,
  )
  html = html.replace(
    /<img src="\/brand\/[^"]*_icon\.png" alt="" width="40" height="40" class="boot-mark" \/>/,
    `<img src="${brandAssets.icon}" alt="" width="40" height="40" class="boot-mark" />`,
  )
  fs.writeFileSync(INDEX_HTML, html)
  console.log(`  ✓ ${path.relative(ROOT, INDEX_HTML)} (favicon links)`)
}

async function writePng(buffer, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  await sharp(buffer).toFile(dest)
  const meta = await sharp(dest).metadata()
  console.log(`  ✓ ${path.relative(ROOT, dest)} (${meta.width}×${meta.height})`)
}

async function writeWebpFromPng(pngBuffer, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  await sharp(pngBuffer).webp({ quality: WEBP_QUALITY }).toFile(dest)
  const meta = await sharp(dest).metadata()
  console.log(`  ✓ ${path.relative(ROOT, dest)} (${meta.width}×${meta.height}, webp)`)
}

function printHelp() {
  console.log(`
Generate brand assets for catbuddy-desktop.

Place master files:
  public/brand/source/icon.png   square icon only (≥512px recommended)
  public/brand/source/logo.png   optional pre-made horizontal logo

Without logo.png, composes icon + "catbuddy" text (cat/buddy two-tone).

Then run:
  pnpm run brand:generate
  pnpm run brand:generate -- --logo-text catbuddy --logo-split 5

Outputs (desktop + web):
  apps/desktop/public/brand/${PREFIX}_*.png
  apps/web/public/brand/${PREFIX}_*.png
  apps/desktop/src/main/assets/icon.png (${ELECTRON_ICON_SIZE}px, for electron-builder)
`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  fs.mkdirSync(SOURCE_DIR, { recursive: true })

  const iconSource = args.icon ?? firstExisting([
    path.join(SOURCE_DIR, 'icon.png'),
    path.join(SOURCE_DIR, 'icon.svg'),
    path.join(BRAND_OUT_DIRS[0], brandFilename('icon.png')),
    ELECTRON_ICON,
  ])

  const logoSource = args.logo ?? firstExisting([
    path.join(SOURCE_DIR, 'logo.png'),
    path.join(SOURCE_DIR, 'logo.svg'),
  ])

  if (!iconSource) {
    console.error('No icon source found. Add apps/desktop/public/brand/source/icon.png or pass --icon <path>')
    process.exit(1)
  }

  console.log(`Icon source:  ${path.relative(ROOT, iconSource)}`)
  if (logoSource) console.log(`Logo source:  ${path.relative(ROOT, logoSource)} (resize)`)
  else if (args.composeLogo) {
    console.log(`Logo:         compose "${args.logoText}" (split @ ${args.logoSplit})`)
  }
  console.log(`Output prefix: ${PREFIX}\n`)

  console.log('Icons:')
  for (const v of ICON_VARIANTS) {
    const buf = await resizeIcon(iconSource, v)
    for (const brandDir of BRAND_OUT_DIRS) {
      await writePng(buf, path.join(brandDir, v.file))
    }
  }

  const electronBuf = await resizeIcon(iconSource, {
    width: ELECTRON_ICON_SIZE,
    height: ELECTRON_ICON_SIZE,
    fit: 'cover',
  })
  await writePng(electronBuf, ELECTRON_ICON)

  console.log('\nLogo:')
  let logoPng
  if (logoSource) {
    logoPng = await resizeLogo(logoSource)
  } else if (args.composeLogo) {
    logoPng = await composeLogoFromIcon(iconSource, {
      text: args.logoText,
      splitAt: args.logoSplit,
      colorA: LOGO_COLOR_A,
      colorB: LOGO_COLOR_B,
    })
  } else {
    console.log('  (skipped — add source/logo.png or pass --compose-logo)')
    logoPng = null
  }
  if (logoPng) {
    for (const brandDir of BRAND_OUT_DIRS) {
      await writePng(logoPng, path.join(brandDir, brandFilename('logo.png')))
      await writeWebpFromPng(logoPng, path.join(brandDir, brandFilename('logo.webp')))
    }
  }

  console.log('\nHTML:')
  syncIndexHtml()

  console.log('\nDone. Commit public/brand/* and apps/desktop/src/main/assets/icon.png if they changed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
