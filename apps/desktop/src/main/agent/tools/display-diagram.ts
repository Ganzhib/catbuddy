import * as fs from 'fs'
import * as path from 'path'
import type { Tool, ToolContext } from './types'

function looksLikeDrawioXml(xml: string): boolean {
  const trimmed = xml.trim()
  return trimmed.startsWith('<mxfile')
    || trimmed.startsWith('<mxGraphModel')
    || trimmed.startsWith('<mxCell')
}

function ensureMxFile(xml: string): string {
  const trimmed = xml.trim()
  if (trimmed.startsWith('<mxfile')) return trimmed
  if (trimmed.startsWith('<mxGraphModel')) {
    return `<mxfile><diagram name="架构图" id="diagram-1">${trimmed}</diagram></mxfile>`
  }
  return `<mxfile><diagram name="架构图" id="diagram-1"><mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${trimmed}</root></mxGraphModel></diagram></mxfile>`
}

function defaultDiagramPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `architecture-${stamp}.drawio`
}

export function createDisplayDiagramTool(ctx: ToolContext): Tool {
  return {
    name: 'display_diagram',
    definition: {
      type: 'function',
      function: {
        name: 'display_diagram',
        description: 'Display a Draw.io architecture diagram in the UI editor and save it as a .drawio file in the workspace.',
        parameters: {
          type: 'object',
          properties: {
            xml: {
              type: 'string',
              minLength: 1,
              description: 'Required non-empty Draw.io XML. Can be a full <mxfile>, <mxGraphModel>, or bare sibling <mxCell> elements. Do not call this tool until XML is ready.',
            },
            path: {
              type: 'string',
              description: 'Optional .drawio file path relative to the project root.',
            },
            title: {
              type: 'string',
              description: 'Optional human readable diagram title.',
            },
          },
          required: ['xml'],
        },
      },
    },
    execute: async (call) => {
      const { xml, path: requestedPath, title } = call.arguments as Record<string, unknown>
      const rawXml = String(xml ?? '').trim()
      if (!rawXml) return 'Error: display_diagram requires a non-empty xml string. Generate valid Draw.io XML first, then call display_diagram with { xml, path?, title? }.'
      if (!looksLikeDrawioXml(rawXml)) {
        return 'Error: display_diagram.xml must be actual Draw.io XML starting with <mxfile>, <mxGraphModel>, or <mxCell>. Do not pass Markdown, ASCII diagrams, Mermaid, or plain text. Generate valid Draw.io XML and retry.'
      }

      const targetPath = String(requestedPath || defaultDiagramPath())
      const normalizedPath = targetPath.toLowerCase().endsWith('.drawio')
        ? targetPath
        : `${targetPath}.drawio`
      const resolved = ctx.resolvePath(normalizedPath)
      const display = ctx.displayPath(resolved)
      const finalXml = ensureMxFile(rawXml)
      const before = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : ''
      const base = {
        call_id: call.id,
        tool: 'display_diagram',
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
        fs.mkdirSync(path.dirname(resolved), { recursive: true })
        fs.writeFileSync(resolved, finalXml, 'utf8')
        const { added, deleted } = ctx.lineDelta(before, finalXml)
        await ctx.notifyFileEdit({
          ...base,
          version: 1,
          phase: 'end',
          status: 'done',
          added: before === '' ? finalXml.split('\n').length : added,
          deleted: before === '' ? 0 : deleted,
          approximate: before !== '',
        })
        await ctx.notifyDiagramEvent?.({
          type: 'display',
          path: display,
          absolutePath: resolved,
          xml: finalXml,
          title: typeof title === 'string' ? title : undefined,
          callId: call.id,
        })
        return `Diagram displayed and saved: ${display}`
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
        return `Error executing display_diagram: ${message}`
      }
    },
  }
}
