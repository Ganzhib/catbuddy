import * as fs from 'fs'
import * as path from 'path'
import type { LLMMessage } from '@catbuddy/shared'

const TEXT_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.cfg',
  '.conf',
  '.config',
  '.cpp',
  '.cs',
  '.css',
  '.csv',
  '.env',
  '.go',
  '.graphql',
  '.h',
  '.hpp',
  '.htm',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.kt',
  '.log',
  '.md',
  '.mdx',
  '.php',
  '.properties',
  '.py',
  '.rb',
  '.rs',
  '.sh',
  '.sql',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.vue',
  '.xml',
  '.yaml',
  '.yml',
])

const MAX_TEXT_ATTACHMENT_CHARS = 120_000

function isLikelyTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  if (TEXT_EXTENSIONS.has(ext)) return true
  try {
    const fd = fs.openSync(filePath, 'r')
    try {
      const buffer = Buffer.alloc(4096)
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, 0)
      if (bytes === 0) return true
      return !buffer.subarray(0, bytes).includes(0)
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return false
  }
}

function readTextAttachment(filePath: string): string | null {
  if (!isLikelyTextFile(filePath)) return null
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    const truncated = data.length > MAX_TEXT_ATTACHMENT_CHARS
      ? `${data.slice(0, MAX_TEXT_ATTACHMENT_CHARS)}\n...[truncated ${data.length - MAX_TEXT_ATTACHMENT_CHARS} chars]`
      : data
    const name = path.basename(filePath)
    return `[uploaded file: ${name}]\n\n${truncated}`
  } catch {
    return null
  }
}

export function buildUserContent(text: string, media: string[]): LLMMessage['content'] {
  if (media.length === 0) return text
  const blocks: any[] = []
  if (text) blocks.push({ type: 'text', text })
  for (const m of media) {
    if (m.startsWith('data:') || m.startsWith('http')) {
      blocks.push({ type: 'image_url', image_url: { url: m } })
      continue
    }

    const textAttachment = readTextAttachment(m)
    if (textAttachment) {
      blocks.push({ type: 'text', text: textAttachment })
      continue
    }

    try {
      const data = fs.readFileSync(m)
      const b64 = data.toString('base64')
      const ext = path.extname(m).slice(1) || 'png'
      blocks.push({ type: 'image_url', image_url: { url: `data:image/${ext};base64,${b64}` } })
    } catch {
      blocks.push({ type: 'text', text: `[attachment: ${m}]` })
    }
  }
  return blocks
}
