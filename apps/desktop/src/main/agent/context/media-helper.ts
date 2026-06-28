import * as fs from 'fs'
import * as path from 'path'
import type { LLMMessage } from '@catbuddy/shared'

export function buildUserContent(text: string, media: string[]): LLMMessage['content'] {
  if (media.length === 0) return text
  const blocks: any[] = []
  if (text) blocks.push({ type: 'text', text })
  for (const m of media) {
    if (m.startsWith('data:') || m.startsWith('http')) {
      blocks.push({ type: 'image_url', image_url: { url: m } })
    } else {
      try {
        const data = fs.readFileSync(m)
        const b64 = data.toString('base64')
        const ext = path.extname(m).slice(1) || 'png'
        blocks.push({ type: 'image_url', image_url: { url: `data:image/${ext};base64,${b64}` } })
      } catch {
        blocks.push({ type: 'text', text: `[image: ${m}]` })
      }
    }
  }
  return blocks
}
