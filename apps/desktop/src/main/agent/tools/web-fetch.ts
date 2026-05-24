import type { Tool } from './types'

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

      if (!/^https?:\/\//i.test(url)) return 'Error: only http/https URLs are allowed'

      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 20000)
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'catbuddy-desktop/1.0' },
        })
        clearTimeout(timer)

        if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`

        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('text/html') && !ct.includes('text/plain')) {
          return `Error: unsupported content type "${ct}"`
        }

        const html = await res.text()
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
        return text || '(empty page)'
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return `Error fetching: ${message}`
      }
    },
  }
}
