/**
 * Tool Registry — 工具注册表 + 内置工具实现
 */
import * as fs from 'fs'
import * as path from 'path'
import { exec as cpExec } from 'child_process'
import type { ToolDefinition, ToolCallRequest } from '../../shared/types'

export interface Tool {
  readonly name: string
  readonly definition: ToolDefinition
  execute(call: ToolCallRequest): Promise<string>
}

export class ToolRegistry {
  private readonly _tools = new Map<string, Tool>()
  private _workspace: string = ''
  private _restrictWorkspace: boolean = false

  /** 设置工作区（用于路径安全检查） */
  setWorkspace(dir: string, restrict: boolean = false) {
    this._workspace = path.resolve(dir)
    this._restrictWorkspace = restrict
  }

  /** 将相对/绝对路径解析到工作区内 */
  resolvePath(inputPath: string): string {
    const p = path.isAbsolute(inputPath)
      ? path.resolve(inputPath)
      : path.resolve(this._workspace, inputPath)
    if (this._restrictWorkspace && !p.startsWith(this._workspace + path.sep) && p !== this._workspace) {
      throw new Error(`Access denied: "${inputPath}" is outside workspace`)
    }
    return p
  }

  register(tool: Tool) {
    this._tools.set(tool.name, tool)
  }

  
  get(name: string): Tool | undefined {
    return this._tools.get(name)
  }

  getDefinitions(): ToolDefinition[] {
    return [...this._tools.values()].map(t => t.definition)
  }

  get toolNames(): string[] {
    return [...this._tools.keys()]
  }

  async execute(call: ToolCallRequest): Promise<string> {
    const tool = this._tools.get(call.name)
    if (!tool) return `Error: unknown tool "${call.name}"`
    try {
      return await tool.execute(call)
    } catch (err: any) {
      return `Error executing ${call.name}: ${err.message}`
    }
  }

  // ═══════════════════════════════════════════════
  //  内置工具注册
  // ═══════════════════════════════════════════════

  registerBuiltinTools() {
    // ── read_file ──
    this.register({
      name: 'read_file',
      definition: {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read the contents of a file. Supports offset/limit for partial reads.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path (relative to workspace or absolute)' },
              offset: { type: 'number', description: 'Line number to start reading from (0-indexed)' },
              limit: { type: 'number', description: 'Maximum number of lines to read' },
            },
            required: ['path'],
          },
        },
      },
      execute: async (call) => {
        const { path: fp, offset = 0, limit } = call.arguments as any
        if (!fp) return 'Error: path required'
        const resolved = this.resolvePath(String(fp))
        const content = fs.readFileSync(resolved, 'utf-8')
        const lines = content.split('\n')
        return lines.slice(Number(offset) || 0, limit ? Number(offset) + Number(limit) : undefined).join('\n')
      },
    })

    // ── write_file ──
    this.register({
      name: 'write_file',
      definition: {
        type: 'function',
        function: {
          name: 'write_file',
          description: 'Write or overwrite a file with the given content.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
              content: { type: 'string', description: 'Content to write' },
            },
            required: ['path', 'content'],
          },
        },
      },
      execute: async (call) => {
        const { path: fp, content } = call.arguments as any
        const resolved = this.resolvePath(String(fp))
        fs.mkdirSync(path.dirname(resolved), { recursive: true })
        fs.writeFileSync(resolved, String(content), 'utf-8')
        return `File written: ${resolved} (${Buffer.byteLength(String(content))} bytes)`
      },
    })

    // ── list_dir ──
    this.register({
      name: 'list_dir',
      definition: {
        type: 'function',
        function: {
          name: 'list_dir',
          description: 'List files and directories in a given path.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Directory path' },
            },
            required: ['path'],
          },
        },
      },
      execute: async (call) => {
        const dirPath = String((call.arguments as any).path)
        const resolved = this.resolvePath(dirPath)
        const entries = fs.readdirSync(resolved, { withFileTypes: true })
        if (entries.length === 0) return '(empty directory)'
        return entries.map(e => {
          const prefix = e.isDirectory() ? '[DIR] ' : e.isFile() ? '[FILE]' : '[LINK]'
          const size = e.isFile() ? ` ${this._formatSize(fs.statSync(path.join(resolved, e.name)).size)}` : ''
          return `${prefix} ${e.name}${size}`
        }).join('\n')
      },
    })

    // ── edit_file ── 精确替换（不支持 regex，只用字符串匹配）
    this.register({
      name: 'edit_file',
      definition: {
        type: 'function',
        function: {
          name: 'edit_file',
          description: 'Perform exact string replacement in an existing file. Provide old_string and new_string.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File to edit' },
              old_string: { type: 'string', description: 'Exact text to replace' },
              new_string: { type: 'string', description: 'Replacement text' },
            },
            required: ['path', 'old_string', 'new_string'],
          },
        },
      },
      execute: async (call) => {
        const { path: fp, old_string, new_string } = call.arguments as any
        const resolved = this.resolvePath(String(fp))
        if (!fs.existsSync(resolved)) return 'Error: file not found'
        const content = fs.readFileSync(resolved, 'utf-8')
        const old = String(old_string)
        const count = content.split(old).length - 1
        if (count === 0) return 'Error: old_string not found in file'
        if (count > 1) return `Error: old_string matches ${count} times — must be unique. Provide more context.`
        const updated = content.replace(old, String(new_string))
        fs.writeFileSync(resolved, updated, 'utf-8')
        return `File edited: ${resolved} (1 replacement, ${updated.split('\n').length} lines)`
      },
    })

    // ── grep ── 文件内容搜索
    this.register({
      name: 'grep',
      definition: {
        type: 'function',
        function: {
          name: 'grep',
          description: 'Search file contents using literal or regex patterns. Supports glob filtering and context lines.',
          parameters: {
            type: 'object',
            properties: {
              pattern: { type: 'string', description: 'Search pattern (literal or regex)' },
              path: { type: 'string', description: 'Directory or file to search in (defaults to workspace)' },
              glob: { type: 'string', description: 'Optional glob filter (e.g. "*.ts", "*.md")' },
              output_mode: { type: 'string', enum: ['content', 'files_with_matches', 'count'], description: 'Output mode' },
              fixed_strings: { type: 'boolean', description: 'Treat pattern as literal string, not regex' },
              context_before: { type: 'number', description: 'Lines of context before each match' },
              context_after: { type: 'number', description: 'Lines of context after each match' },
              head_limit: { type: 'number', description: 'Max number of matches to return' },
            },
            required: ['pattern'],
          },
        },
      },
      execute: async (call) => {
        const a = call.arguments as any
        const pattern = String(a.pattern)
        const baseDir = this.resolvePath(String(a.path || this._workspace))
        const glob = String(a.glob || '*')
        const fixedStrings = !!a.fixed_strings
        const outputMode = String(a.output_mode || 'content')
        const ctxBefore = Number(a.context_before) || 0
        const ctxAfter = Number(a.context_after) || 0
        const headLimit = Number(a.head_limit) || 50

        let regex: RegExp
        try { regex = fixedStrings ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') : new RegExp(pattern, 'gi') }
        catch { return `Error: invalid pattern "${pattern}"` }

        const results: string[] = []
        const walkDir = (dir: string) => {
          if (results.length >= headLimit) return
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (results.length >= headLimit) break
            const fp = path.join(dir, entry.name)
            if (entry.isDirectory()) {
              if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
              walkDir(fp)
            } else if (entry.isFile()) {
              if (!this._matchGlob(entry.name, glob)) continue
              if (this._isBinary(fp)) continue
              try {
                const content = fs.readFileSync(fp, 'utf-8')
                const lines = content.split('\n')
                let matches = 0
                for (let i = 0; i < lines.length && results.length < headLimit; i++) {
                  if (regex.test(lines[i])) {
                    regex.lastIndex = 0
                    matches++
                    if (outputMode === 'files_with_matches') {
                      results.push(`[FILE] ${fp}`)
                      break // one per file
                    } else if (outputMode === 'count') continue
                    else {
                      const start = Math.max(0, i - ctxBefore)
                      const end = Math.min(lines.length, i + ctxAfter + 1)
                      for (let j = start; j < end; j++) {
                        results.push(`${fp}:${j + 1}: ${lines[j]}`)
                      }
                    }
                  }
                }
                if (outputMode === 'count' && matches > 0) results.push(`${fp}: ${matches} matches`)
              } catch {}
            }
          }
        }

        if (fs.statSync(baseDir).isFile()) {
          // single file
          const content = fs.readFileSync(baseDir, 'utf-8')
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              regex.lastIndex = 0
              results.push(`${baseDir}:${i + 1}: ${lines[i]}`)
            }
          }
        } else {
          walkDir(baseDir)
        }

        return results.length > 0 ? results.slice(0, headLimit).join('\n') : '(no matches)'
      },
    })

    // ── web_search ── DuckDuckGo Instant Answer
    this.register({
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
        const { query, max_results = 5 } = call.arguments as any
        const q = encodeURIComponent(String(query))
        const maxR = Math.min(Number(max_results) || 5, 10)

        // 用 DuckDuckGo Lite（免 API key）
        const url = `https://lite.duckduckgo.com/lite/?q=${q}`
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 15000)
          const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'nanobot-desktop/1.0' } })
          clearTimeout(timer)
          const html = await res.text()

          // 简单 HTML 解析：提取标题 + 链接
          const results: string[] = []
          const linkRe = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g
          const snippetRe = /<td class="snippet">([^<]+)/g
          let m
          let i = 0
          while ((m = linkRe.exec(html)) !== null) {
            const url = m[1]
            const title = m[2]
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .trim()
            // 跳过非结果链接
            if (!url.startsWith('http') || !title || title === 'More results') continue
            const sm = snippetRe.exec(html)
            const snippet = sm ? sm[1].replace(/&amp;/g, '&').trim() : ''
            results.push(`${i + 1}. **${title}**\n   ${snippet}\n   ${url}`)
            i++
            if (i >= maxR) break
          }

          return results.length > 0 ? results.join('\n\n') : `(no results for "${query}")`
        } catch (err: any) {
          return `Error searching: ${err.message}`
        }
      },
    })

    // ── web_fetch ── 抓取网页内容
    this.register({
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
        const { url: rawUrl, max_length = 10000 } = call.arguments as any
        const url = String(rawUrl)
        const maxLen = Number(max_length) || 10000

        // SSRF 基本防护：只允许 http/https
        if (!/^https?:\/\//i.test(url)) return 'Error: only http/https URLs are allowed'

        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 20000)
          const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'nanobot-desktop/1.0' } })
          clearTimeout(timer)

          if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`

          const ct = res.headers.get('content-type') || ''
          if (!ct.includes('text/html') && !ct.includes('text/plain')) {
            return `Error: unsupported content type "${ct}"`
          }

          const html = await res.text()
          // 简单去 HTML 标签 + 去空白
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
        } catch (err: any) {
          return `Error fetching: ${err.message}`
        }
      },
    })

    // ── exec ── 执行 shell 命令
    this.register({
      name: 'exec',
      definition: {
        type: 'function',
        function: {
          name: 'exec',
          description: 'Execute a shell command with timeout. Working directory defaults to workspace. Output is truncated.',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Shell command to execute' },
              working_dir: { type: 'string', description: 'Working directory (default: workspace)' },
              timeout: { type: 'number', description: 'Timeout in seconds (default 30, max 120)' },
            },
            required: ['command'],
          },
        },
      },
      execute: async (call) => {
        const { command, working_dir, timeout = 30 } = call.arguments as any
        const cmd = String(command)
        const cwd = working_dir ? this.resolvePath(String(working_dir)) : this._workspace
        const to = Math.min(Number(timeout) || 30, 120)

        // 危险命令拦截
        const dangerous = /\brm\s+-rf\b|\bformat\b|\bdd\b|\bmkfs\b|\b:\(\)\b|\bchmod\s+777\b/i
        if (dangerous.test(cmd)) return 'Error: dangerous command blocked'

        return new Promise<string>(resolve => {
          cpExec(cmd, { cwd, timeout: to * 1000, maxBuffer: 100 * 1024, windowsHide: true }, (err, stdout, stderr) => {
            let output = ''

            if (stdout) {
              output += stdout.length > 10000
                ? stdout.slice(0, 10000) + '\n... (stdout truncated)'
                : stdout
            }
            if (stderr) {
              output += '\n[stderr]\n'
              output += stderr.length > 5000
                ? stderr.slice(0, 5000) + '\n... (stderr truncated)'
                : stderr
            }
            if (err) {
              output += `\nExit code: ${(err as any).code ?? err.message}`
            }

            resolve(output.trim() || `(executed: ${cmd.slice(0, 80)})`)
          })
        })
      },
    })

    // ── generate_image ── 图片生成（OpenAI DALL-E 兼容）
    this.register({
      name: 'generate_image',
      definition: {
        type: 'function',
        function: {
          name: 'generate_image',
          description: 'Generate an image using AI. Returns the saved file path.',
          parameters: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'Image description' },
              size: { type: 'string', enum: ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'], description: 'Image size (default 1024x1024)' },
              quality: { type: 'string', enum: ['standard', 'hd'], description: 'Image quality (default standard)' },
              style: { type: 'string', enum: ['vivid', 'natural'], description: 'Image style (default vivid)' },
            },
            required: ['prompt'],
          },
        },
      },
      execute: async (call) => {
        const { prompt, size = '1024x1024', quality = 'standard', style = 'vivid' } = call.arguments as any
        const apiKey = process.env.OPENAI_API_KEY || (this as any)._imgGenKey
        const apiBase = process.env.IMAGE_GEN_BASE || 'https://api.openai.com/v1'

        if (!apiKey) return 'Error: No image generation API key configured. Set OPENAI_API_KEY.'

        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 60000)
          const res = await fetch(`${apiBase}/images/generations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'dall-e-3',
              prompt: String(prompt),
              n: 1,
              size: String(size),
              quality: String(quality),
              style: String(style),
            }),
            signal: controller.signal,
          })
          clearTimeout(timer)

          if (!res.ok) {
            const text = await res.text()
            return `Error: ${res.status} ${text.slice(0, 200)}`
          }

          const data = await res.json()
          const imageUrl = data.data?.[0]?.url

          if (!imageUrl) return 'Error: no image URL in response'

          // 下载图片到 workspace
          const imgRes = await fetch(imageUrl)
          const buf = Buffer.from(await imgRes.arrayBuffer())
          const filename = `generated_${Date.now()}.png`
          const filePath = path.join(this._workspace, 'images', filename)
          fs.mkdirSync(path.dirname(filePath), { recursive: true })
          fs.writeFileSync(filePath, buf)

          return `Image generated: ${filename} (${size}, ${(buf.length / 1024).toFixed(1)}KB)\nSaved to: ${filePath}`
        } catch (err: any) {
          return `Error generating image: ${err.message}`
        }
      },
    })

    console.log('[tools] Registered 9 tools:', this.toolNames.join(', '))
  }

  // ═══ 工具函数 ═══

  private _matchGlob(filename: string, glob: string): boolean {
    // 简单 glob → regex
    const re = new RegExp('^' + glob.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')
    return re.test(filename)
  }

  private _isBinary(fp: string): boolean {
    try {
      const buf = fs.readFileSync(fp).slice(0, 512)
      return buf.includes(0) || buf.filter(b => b < 9 && b !== 0x0a && b !== 0x0d && b !== 0x09).length > 1
    } catch { return true }
  }

  private _formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }
}
