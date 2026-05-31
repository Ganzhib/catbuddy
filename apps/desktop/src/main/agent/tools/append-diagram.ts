import * as fs from 'fs'
import type { Tool, ToolContext } from './types'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeDrawioPath(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed
  return trimmed.toLowerCase().endsWith('.drawio') ? trimmed : `${trimmed}.drawio`
}

function rootCloseIndex(xml: string): number {
  return xml.lastIndexOf('</root>')
}

function extractMxCells(fragment: string): string[] {
  const matches = fragment.match(/<mxCell\b[^>]*(?:\/>|>[\s\S]*?<\/mxCell>)/gm)
  return matches?.map((cell) => cell.trim()).filter(Boolean) ?? []
}

function cellId(cellXml: string): string | null {
  const match = cellXml.match(/\bid=["']([^"']+)["']/)
  return match?.[1] ?? null
}

function hasCell(xml: string, id: string): boolean {
  const escaped = escapeRegExp(id)
  return new RegExp(`<mxCell\\b(?=[^>]*\\bid=["']${escaped}["'])`, 'm').test(xml)
}

function validateCells(existingXml: string, cells: string[]): string | null {
  if (cells.length === 0) return 'No complete <mxCell> elements found in xml'

  const seen = new Set<string>()
  for (const cell of cells) {
    const id = cellId(cell)
    if (!id) return 'Every appended mxCell must have an id attribute'
    if (id === '0' || id === '1') return 'Do not append root cells id="0" or id="1"'
    if (seen.has(id)) return `Duplicate cell id in appended fragment: ${id}`
    if (hasCell(existingXml, id)) return `Cell already exists in diagram: ${id}`
    seen.add(id)
  }
  return null
}

export function createAppendDiagramTool(ctx: ToolContext): Tool {
  return {
    name: 'append_diagram',
    definition: {
      type: 'function',
      function: {
        name: 'append_diagram',
        description: 'Append complete Draw.io mxCell XML elements to an existing .drawio diagram, then refresh the UI editor. Use this for large diagrams generated in chunks.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Existing .drawio file path relative to the project root.',
            },
            xml: {
              type: 'string',
              description: 'One or more complete <mxCell> elements to append inside the diagram root.',
            },
          },
          required: ['path', 'xml'],
        },
      },
    },
    execute: async (call) => {
      const { path: requestedPath, xml } = call.arguments as Record<string, unknown>
      const targetPath = normalizeDrawioPath(String(requestedPath ?? ''))
      const fragment = String(xml ?? '').trim()
      if (!targetPath) return 'Error: path is required'
      if (!fragment) return 'Error: xml is required'

      const resolved = ctx.resolvePath(targetPath)
      const display = ctx.displayPath(resolved)
      if (!fs.existsSync(resolved)) return `Error: diagram file not found: ${display}`

      const before = fs.readFileSync(resolved, 'utf8')
      const idx = rootCloseIndex(before)
      if (idx < 0) return `Error: could not find </root> in ${display}`

      const cells = extractMxCells(fragment)
      const validationError = validateCells(before, cells)
      if (validationError) return `Error appending diagram: ${validationError}`

      const base = {
        call_id: call.id,
        tool: 'append_diagram',
        path: display,
        absolute_path: resolved,
      }

      await ctx.notifyFileEdit({
        ...base,
        version: 1,
        phase: 'start',
        status: 'editing',
        added: 0,
        deleted: 0,
      })

      try {
        const appended = cells.join('\n')
        const after = `${before.slice(0, idx)}\n${appended}\n${before.slice(idx)}`
        fs.writeFileSync(resolved, after, 'utf8')
        const { added, deleted } = ctx.lineDelta(before, after)
        await ctx.notifyFileEdit({
          ...base,
          version: 1,
          phase: 'end',
          status: 'done',
          added,
          deleted,
          approximate: true,
        })
        await ctx.notifyDiagramEvent?.({
          type: 'display',
          path: display,
          absolutePath: resolved,
          xml: after,
          callId: call.id,
        })
        return `Appended ${cells.length} diagram cell(s) and refreshed: ${display}`
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        await ctx.notifyFileEdit({
          ...base,
          version: 1,
          phase: 'error',
          status: 'error',
          added: 0,
          deleted: 0,
          error: message,
        })
        await ctx.notifyDiagramEvent?.({
          type: 'error',
          path: display,
          absolutePath: resolved,
          error: message,
          callId: call.id,
        })
        return `Error executing append_diagram: ${message}`
      }
    },
  }
}
