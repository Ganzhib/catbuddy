import type { Tool } from './types'
import {
  MAX_REDIRECTS,
  UNTRUSTED_BANNER,
  validateUrlTarget,
} from '../../security/network.js'

export function createWebFetchTool(): Tool {
  return {
    name: 'web_fetch',
    definition: {
      type: 'function',
      function: {
        name: 'web_fetch',
        description: 'Fetch and extract text content from a URL. Strips HTML, returns plain text.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to fetch' },
            max_length: { type: 'number', description: 'Max characters to return (default 10000)' },
          },
          required: ['url'],
        },
      },
    },
    execute: async (call) => {
      const { url: rawUrl, max_length = 10000 } = call.arguments as Record<string, unknown>
      const url = String(rawUrl)
      const maxLen = Number(max_length) || 10000

      const [safe, err] = await validateUrlTarget(url)
      if (!safe) return `Error: ${err}`

      try {
        const html = await fetchWithSafeRedirects(url)
        let text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#?\w+;/g, '')
          .replace(/\s+/g, ' ')
          .trim()

        if (text.length > maxLen) text = text.slice(0, maxLen) + '\n... (truncated)'
        const body = text || '(empty page)'
        return `${UNTRUSTED_BANNER}\n\n${body}`
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return `Error fetching: ${message}`
      }
    },
  }
}

async function fetchWithSafeRedirects(url: string): Promise<string> {
  let current = url
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const [ok, err] = await validateUrlTarget(current)
    if (!ok) throw new Error(`Redirect blocked: ${err}`)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    const res = await fetch(current, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { 'User-Agent': 'catbuddy-desktop/1.0' },
    })
    clearTimeout(timer)

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return await res.text()
      current = new URL(location, current).href
      continue
    }

    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)

    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html') && !ct.includes('text/plain')) {
      throw new Error(`unsupported content type "${ct}"`)
    }
    return res.text()
  }
  throw new Error(`Too many redirects: exceeded limit of ${MAX_REDIRECTS}`)
}
