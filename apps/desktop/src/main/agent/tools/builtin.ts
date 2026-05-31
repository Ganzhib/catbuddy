import type { ToolFactory } from './types'
import { createAppendDiagramTool } from './append-diagram'
import { createDisplayDiagramTool } from './display-diagram'
import { createEditDiagramTool } from './edit-diagram'
import { createEditFileTool } from './edit-file'
import { createExecTool } from './exec'
import { createGenerateImageTool } from './generate-image'
import { createExecSessionTool } from './exec_session'
import { createGrepTool } from './grep'
import { createListDirTool } from './list-dir'
import { createReadFileTool } from './read-file'
import { createWebFetchTool } from './web-fetch'
import { createWebSearchTool } from './web-search'
import { createWriteFileTool } from './write-file'

/** Ordered list of built-in tool factories (Registry + Factory). */
export const builtinToolFactories: ToolFactory[] = [
  createReadFileTool,
  createDisplayDiagramTool,
  createAppendDiagramTool,
  createEditDiagramTool,
  createWriteFileTool,
  createListDirTool,
  createEditFileTool,
  createGrepTool,
  () => createWebSearchTool(),
  () => createWebFetchTool(),
  createExecTool,
  createExecSessionTool,
  createGenerateImageTool,
]
