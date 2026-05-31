import * as fs from 'fs'
import type { Tool, ToolContext } from './types'

type DiagramOperation =
  | { operation: 'update'; cell_id: string; new_xml: string }
  | { operation: 'add'; cell_id: string; new_xml: string }
  | { operation: 'delete'; cell_id: string }

interface OperationError {
  operation: string
  cellId: string
  message: string
}

interface ApplyResult {
  xml: string
  applied: number
  errors: OperationError[]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeDrawioPath(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed
  return trimmed.toLowerCase().endsWith('.drawio') ? trimmed : `${trimmed}.drawio`
}

function cellRegex(cellId: string): RegExp {
  const id = escapeRegExp(cellId)
  return new RegExp(
    `<mxCell\\b(?=[^>]*\\bid=["']${id}["'])[^>]*(?:\\/>|>[\\s\\S]*?<\\/mxCell>)`,
    'm',
  )
}

function rootCloseIndex(xml: string): number {
  return xml.lastIndexOf('</root>')
}

function hasCell(xml: string, cellId: string): boolean {
  return cellRegex(cellId).test(xml)
}

function validateNewCellXml(cellId: string, newXml: string): string | null {
  const trimmed = newXml.trim()
  if (!trimmed.startsWith('<mxCell')) return 'new_xml must start with <mxCell'
  if (!cellRegex(cellId).test(trimmed)) {
    return `new_xml must contain mxCell with id="${cellId}"`
  }
  return null
}

function deleteCellAndReferencingEdges(xml: string, cellId: string): { xml: string; removed: number } {
  let next = xml
  let removed = 0
  const direct = cellRegex(cellId)
  if (direct.test(next)) {
    next = next.replace(direct, () => {
      removed += 1
      return ''
    })
  }

  const id = escapeRegExp(cellId)
  const edge = new RegExp(
    `<mxCell\\b(?=[^>]*\\bedge=["']1["'])(?=[^>]*(?:\\bsource=["']${id}["']|\\btarget=["']${id}["']))[^>]*(?:\\/>|>[\\s\\S]*?<\\/mxCell>)`,
    'gm',
  )
  next = next.replace(edge, () => {
    removed += 1
    return ''
  })
  return { xml: next, removed }
}

function applyDiagramOperations(xml: string, operations: DiagramOperation[]): ApplyResult {
  let next = xml
  const errors: OperationError[] = []
  let applied = 0

  for (const op of operations) {
    if (!op || typeof op.operation !== 'string' || typeof op.cell_id !== 'string') {
      errors.push({ operation: 'unknown', cellId: '', message: 'Invalid operation shape' })
      continue
    }

    if (op.cell_id === '0' || op.cell_id === '1') {
      errors.push({ operation: op.operation, cellId: op.cell_id, message: 'Root cells cannot be modified' })
      continue
    }

    if (op.operation === 'update') {
      const err = validateNewCellXml(op.cell_id, op.new_xml)
      if (err) {
        errors.push({ operation: 'update', cellId: op.cell_id, message: err })
        continue
      }
      const re = cellRegex(op.cell_id)
      if (!re.test(next)) {
        errors.push({ operation: 'update', cellId: op.cell_id, message: 'Cell not found' })
        continue
      }
      next = next.replace(re, op.new_xml.trim())
      applied += 1
      continue
    }

    if (op.operation === 'add') {
      const err = validateNewCellXml(op.cell_id, op.new_xml)
      if (err) {
        errors.push({ operation: 'add', cellId: op.cell_id, message: err })
        continue
      }
      if (hasCell(next, op.cell_id)) {
        errors.push({ operation: 'add', cellId: op.cell_id, message: 'Cell already exists' })
        continue
      }
      const idx = rootCloseIndex(next)
      if (idx < 0) {
        errors.push({ operation: 'add', cellId: op.cell_id, message: 'Could not find </root>' })
        continue
      }
      next = `${next.slice(0, idx)}\n${op.new_xml.trim()}\n${next.slice(idx)}`
      applied += 1
      continue
    }

    if (op.operation === 'delete') {
      if (!hasCell(next, op.cell_id)) {
        errors.push({ operation: 'delete', cellId: op.cell_id, message: 'Cell not found' })
        continue
      }
      const deleted = deleteCellAndReferencingEdges(next, op.cell_id)
      next = deleted.xml
      applied += deleted.removed > 0 ? 1 : 0
      continue
    }

    errors.push({ operation: String((op as { operation?: unknown }).operation ?? 'unknown'), cellId: String((op as { cell_id?: unknown }).cell_id ?? ''), message: 'Unsupported operation' })
  }

  return { xml: next, applied, errors }
}

export function createEditDiagramTool(ctx: ToolContext): Tool {
  return {
    name: 'edit_diagram',
    definition: {
      type: 'function',
      function: {
        name: 'edit_diagram',
        description: 'Edit an existing Draw.io .drawio diagram by applying id-based mxCell operations, then refresh the UI editor.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Existing .drawio file path relative to the project root.',
            },
            operations: {
              type: 'array',
              description: 'Operations to apply by mxCell id.',
              items: {
                type: 'object',
                properties: {
                  operation: { type: 'string', enum: ['update', 'add', 'delete'] },
                  cell_id: { type: 'string' },
                  new_xml: { type: 'string', description: 'Complete mxCell XML for update/add.' },
                },
                required: ['operation', 'cell_id'],
              },
            },
          },
          required: ['path', 'operations'],
        },
      },
    },
    execute: async (call) => {
      const { path: requestedPath, operations } = call.arguments as Record<string, unknown>
      const targetPath = normalizeDrawioPath(String(requestedPath ?? ''))
      if (!targetPath) return 'Error: path is required'
      if (!Array.isArray(operations) || operations.length === 0) {
        return 'Error: operations must be a non-empty array'
      }

      const resolved = ctx.resolvePath(targetPath)
      const display = ctx.displayPath(resolved)
      if (!fs.existsSync(resolved)) return `Error: diagram file not found: ${display}`

      const before = fs.readFileSync(resolved, 'utf8')
      const base = {
        call_id: call.id,
        tool: 'edit_diagram',
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

      const result = applyDiagramOperations(before, operations as DiagramOperation[])
      if (result.errors.length > 0) {
        const detail = result.errors
          .map((e) => `${e.operation} ${e.cellId}: ${e.message}`)
          .join('; ')
        await ctx.notifyFileEdit({
          ...base,
          version: 1,
          phase: 'error',
          status: 'error',
          added: 0,
          deleted: 0,
          error: detail,
        })
        return `Error editing diagram: ${detail}`
      }

      fs.writeFileSync(resolved, result.xml, 'utf8')
      const { added, deleted } = ctx.lineDelta(before, result.xml)
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
        xml: result.xml,
        callId: call.id,
      })
      return `Applied ${result.applied} diagram operation(s) and refreshed: ${display}`
    },
  }
}
