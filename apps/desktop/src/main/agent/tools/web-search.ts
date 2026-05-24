import type { Tool } from './types'

export function createWebSearchTool(): Tool {
  return {
    name: 'web_search',
    definition: {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web using DuckDuckGo. Returns titles, snippets, and URLs.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            max_results: { type: 'number', description: 'Max results (default 5, max 10)' },
          },
          required: ['query'],
        },
      },
    },
    execute: async (call) => {
      const { query, max_results = 5 } = call.arguments as Record<string, unknown>
      const q = encodeURIComponent(String(query))
      const maxR = Math.min(Number(max_results) || 5, 10)
      const url = `https://lite.duckduckgo.com/lite/?q=${q}`
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 15000)
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'catbuddy-desktop/1.0' },
        })
        clearTimeout(timer)
        const html = await res.text()

        const results: string[] = []
        const linkRe = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g
        const snippetRe = /<td class="snippet">([^<]+)/g
        let m
        let i = 0
        while ((m = linkRe.exec(html)) !== null) {
          const href = m[1]
          const title = m[2]
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim()
          if (!href.startsWith('http') || !title || title === 'More results') continue
          const sm = snippetRe.exec(html)
          const snippet = sm ? sm[1].replace(/&amp;/g, '&').trim() : ''
          results.push(`${i + 1}. **${title}**\n   ${snippet}\n   ${href}`)
          i++
          if (i >= maxR) break
        }

        return results.length > 0 ? results.join('\n\n') : `(no results for "${query}")`
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return `Error searching: ${message}`
      }
    },
  }
}
