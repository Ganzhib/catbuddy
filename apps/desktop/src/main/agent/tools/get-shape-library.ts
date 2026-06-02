import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Tool, ToolContext } from './types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveLibrariesDir(): string {
  // Shape library docs are bundled alongside this tool
  return path.join(__dirname, 'shape-libraries')
}

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '')
}

export function createGetShapeLibraryTool(_ctx: ToolContext): Tool {
  return {
    name: 'get_shape_library',
    definition: {
      type: 'function',
      function: {
        name: 'get_shape_library',
        description: `Get draw.io shape/icon library documentation with style syntax and shape names for cloud architecture diagrams.

Available libraries:
- Cloud: aws4 (AWS), gcp2 (GCP), azure2 (Azure)
- Orchestration: kubernetes (K8s)
- General: flowchart, basic, arrows2
- Business: bpmn (BPMN process), lean_mapping
- Networking: cisco19, network

Call this tool to discover icon shapes and their usage syntax BEFORE creating cloud architecture or technical diagrams.`,
        parameters: {
          type: 'object',
          properties: {
            library: {
              type: 'string',
              description: 'Library name (e.g. "aws4", "kubernetes", "flowchart"). Use the exact names listed above.',
            },
          },
          required: ['library'],
        },
      },
    },
    execute: async (call) => {
      const { library } = call.arguments as Record<string, unknown>
      const raw = String(library ?? '').trim()
      if (!raw) return 'Error: library name is required.'

      const safe = sanitizeName(raw)
      if (safe !== raw.toLowerCase()) {
        return `Invalid library name "${raw}". Use only letters, numbers, underscores, and hyphens.`
      }

      const libDir = resolveLibrariesDir()
      const filePath = path.join(libDir, `${safe}.md`)
      const resolved = path.resolve(filePath)

      // Path traversal protection
      if (!resolved.startsWith(path.resolve(libDir))) {
        return 'Error: invalid library path.'
      }

      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        return content
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // List available libraries when requested one doesn't exist
          let available = ''
          try {
            available = fs.readdirSync(libDir)
              .filter((f) => f.endsWith('.md'))
              .map((f) => f.replace('.md', ''))
              .join(', ')
          } catch {
            available = 'flowchart, kubernetes, aws4'
          }
          return `Library "${raw}" not found. Available: ${available}`
        }
        return `Error loading library "${raw}". Please try another.`
      }
    },
  }
}
