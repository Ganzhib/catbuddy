#!/usr/bin/env node
/**
 * Remove background from public/brand/source/icon.png (AI cutout).
 *
 * Usage:
 *   pnpm run brand:cutout
 *   pnpm run brand:cutout -- --input ./photo.png --output ./icon.png
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DEFAULT_INPUT = path.join(ROOT, 'public', 'brand', 'source', 'icon.png')

function parseArgs(argv) {
  const out = { input: DEFAULT_INPUT, output: null, backup: true }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) out.input = path.resolve(argv[++i])
    else if (argv[i] === '--output' && argv[i + 1]) out.output = path.resolve(argv[++i])
    else if (argv[i] === '--no-backup') out.backup = false
    else if (argv[i] === '--help' || argv[i] === '-h') out.help = true
  }
  if (!out.output) out.output = out.input
  return out
}

async function removeWithImgly(inputPath) {
  const { removeBackground } = await import('@imgly/background-removal-node')
  // Windows paths must be file:// URLs for imgly
  const blob = await removeBackground(pathToFileURL(inputPath).href, {
    model: 'medium',
    output: { format: 'image/png', type: 'foreground' },
    debug: false,
  })
  return Buffer.from(await blob.arrayBuffer())
}

/** Fallback: corner-sampled bg + soft alpha (OK for flat color, weak on fur). */
async function removeWithSharp(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const bg = sampleCornerBackground(data, width, height, channels)
  const threshold = 42
  const softness = 28

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const dist = colorDist(data[i], data[i + 1], data[i + 2], bg)
      let alpha = 255
      if (dist < threshold) alpha = 0
      else if (dist < threshold + softness) {
        alpha = Math.round((255 * (dist - threshold)) / softness)
      }
      data[i + 3] = alpha
    }
  }

  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

function sampleCornerBackground(data, width, height, channels) {
  const pts = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
  ]
  let r = 0
  let g = 0
  let b = 0
  for (const [x, y] of pts) {
    const i = (y * width + x) * channels
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  const n = pts.length
  return { r: r / n, g: g / n, b: b / n }
}

function colorDist(r, g, b, bg) {
  return Math.sqrt((r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2)
}

function printHelp() {
  console.log(`
Remove background from brand icon (transparent PNG).

  pnpm run brand:cutout
  pnpm run brand:cutout -- --input public/brand/source/icon.png

Backs up original to icon.original.png, then overwrites icon.png.
First AI run downloads ~40MB model (cached afterward).
Then run: pnpm run brand:generate
`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  if (!fs.existsSync(args.input)) {
    console.error(`Input not found: ${args.input}`)
    process.exit(1)
  }

  console.log(`Input:  ${path.relative(ROOT, args.input)}`)
  console.log(`Output: ${path.relative(ROOT, args.output)}`)
  console.log('Removing background (AI, first run may take a minute)…\n')

  let pngBuf
  let method = 'imgly'
  try {
    pngBuf = await removeWithImgly(args.input)
  } catch (err) {
    console.warn('AI cutout failed, using simple color fallback:', err?.message ?? err)
    method = 'sharp-fallback'
    pngBuf = await removeWithSharp(args.input)
  }

  if (args.backup && args.output === args.input) {
    const backup = args.input.replace(/\.png$/i, '.original.png')
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(args.input, backup)
      console.log(`  backup → ${path.relative(ROOT, backup)}`)
    }
  }

  const trimmed = await sharp(pngBuf).trim({ threshold: 10 }).png().toBuffer()
  fs.mkdirSync(path.dirname(args.output), { recursive: true })
  await sharp(trimmed).png().toFile(args.output)

  const meta = await sharp(args.output).metadata()
  console.log(`  ✓ ${path.relative(ROOT, args.output)} (${meta.width}×${meta.height}, ${method})`)
  console.log('\nNext: pnpm run brand:generate')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
