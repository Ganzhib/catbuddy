import type { SlashCommand } from './ui-types.js'

/** Desktop built-in slash commands — shared by main process IPC and renderer fallback. */
export const DESKTOP_BUILTIN_SLASH_COMMANDS: SlashCommand[] = [
  {
    command: '/new',
    title: '新对话',
    description: '清除当前会话历史，开始新对话',
    icon: 'square-pen',
  },
  {
    command: '/stop',
    title: '停止任务',
    description: '取消当前正在运行的 Agent 任务',
    icon: 'square',
  },
  {
    command: '/status',
    title: '运行状态',
    description: '显示模型、运行时间、活跃会话等状态',
    icon: 'activity',
  },
  {
    command: '/model',
    title: '切换模型',
    description: '显示或切换模型预设',
    icon: 'brain',
    argHint: '[preset]',
  },
  {
    command: '/history',
    title: '历史记录',
    description: '查看最近 N 条会话消息',
    icon: 'history',
    argHint: '[n]',
  },
  {
    command: '/compact',
    title: '压缩上下文',
    description: '将较早对话摘要写入 MEMORY.md（保留最近 2 条）',
    icon: 'folder-down',
  },
  {
    command: '/dream',
    title: '运行 Dream',
    description: '从 history.jsonl 提炼长期记忆到 MEMORY.md',
    icon: 'moon',
  },
  {
    command: '/dream-log',
    title: 'Dream 日志',
    description: '查看最近一次 Dream 写入的内容',
    icon: 'scroll-text',
  },
  {
    command: '/help',
    title: '帮助',
    description: '列出所有可用命令',
    icon: 'circle-help',
  },
]
