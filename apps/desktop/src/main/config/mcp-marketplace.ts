import type { McpMarketplaceEntry, McpServerConfig } from '@catbuddy/shared'

const homePlaceholder = process.platform === 'win32' ? '%USERPROFILE%' : '$HOME'

function pasteTemplate(config: Record<string, unknown>): string {
  return JSON.stringify(config, null, 2)
}

export const MCP_MARKETPLACE: McpMarketplaceEntry[] = [
  {
    id: 'filesystem',
    name: '文件系统',
    description: '允许 Agent 读写你的用户目录，适合整理文件、批量处理文档和生成项目素材。',
    category: '一键可用',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    setupNote: `默认授权目录：${homePlaceholder}。如需限制范围，可添加后在配置中改成指定项目目录。`,
    config: {
      filesystem: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', homePlaceholder],
      },
    },
  },
  {
    id: 'memory',
    name: '记忆',
    description: '提供持久化知识图谱记忆，让 Agent 记录偏好、项目事实和长期上下文。',
    category: '一键可用',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    config: {
      memory: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
      },
    },
  },
  {
    id: 'sequential-thinking',
    name: '顺序思考',
    description: '把复杂任务拆成可检查步骤，适合排查 bug、方案设计和长链路决策。',
    category: '一键可用',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
    config: {
      sequential_thinking: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      },
    },
  },
  {
    id: 'everything',
    name: 'MCP 诊断工具',
    description: '官方测试服务器，适合确认 MCP 启动、工具注册和调用链路是否正常。',
    category: '一键可用',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/everything',
    config: {
      everything: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-everything'],
      },
    },
  },
  {
    id: 'github',
    name: 'GitHub',
    description: '管理仓库、Issue、Pull Request 和代码检索。需要个人访问令牌。',
    category: '需配置',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    pasteOnly: true,
    requiresEnv: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    setupNote: '需要先创建 GitHub Personal Access Token。复制模板后替换 <your-token>，再粘贴应用。',
    pasteTemplate: pasteTemplate({
      github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: '<your-token>' },
      },
    }),
    config: {},
  },
  {
    id: 'brave-search',
    name: 'Brave 搜索',
    description: '通过 Brave Search API 获取网页搜索结果。需要 API Key。',
    category: '需配置',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
    pasteOnly: true,
    requiresEnv: ['BRAVE_API_KEY'],
    setupNote: '需要先申请 Brave Search API Key。复制模板后替换 <your-api-key>，再粘贴应用。',
    pasteTemplate: pasteTemplate({
      brave_search: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: { BRAVE_API_KEY: '<your-api-key>' },
      },
    }),
    config: {},
  },
  {
    id: 'feishu-lark',
    name: '飞书 / Lark',
    description: '飞书开放平台能力：文档、消息、日历、多维表格等。需要应用凭据。',
    category: '需配置',
    docsUrl: 'https://github.com/larksuite/lark-openapi-mcp',
    pasteOnly: true,
    requiresEnv: ['FEISHU_APP_ID', 'FEISHU_APP_SECRET'],
    setupNote: '需要在飞书开放平台创建应用。复制模板后替换 App ID 和 App Secret，再粘贴应用。',
    pasteTemplate: pasteTemplate({
      feishu: {
        command: 'npx',
        args: [
          '-y',
          '@larksuiteoapi/lark-mcp',
          'mcp',
          '-a',
          '<FEISHU_APP_ID>',
          '-s',
          '<FEISHU_APP_SECRET>',
        ],
      },
    }),
    config: {},
  },
  {
    id: 'tencent-docs',
    name: '腾讯文档',
    description: '腾讯文档远程 MCP：文档编辑、搜索空间、读取正文。',
    category: '需配置',
    docsUrl: 'https://docs.qq.com/open/document/mcp/',
    pasteOnly: true,
    setupNote: '这是远程 HTTP MCP。当前桌面端主要支持 stdio，请等待 HTTP transport 支持或自行配置兼容网关。',
    pasteTemplate: pasteTemplate({
      tencent_docs: {
        url: 'https://docs.qq.com/openapi/mcp',
        headers: { Authorization: '<your-token>' },
      },
    }),
    config: {},
  },
]

/** Resolve placeholders like $HOME in marketplace configs for the current machine. */
export function resolveMarketplaceConfig(
  config: Record<string, McpServerConfig>,
): Record<string, McpServerConfig> {
  const home = process.env.HOME || process.env.USERPROFILE || '.'
  const replacePlaceholders = (value: string) =>
    value
      .replace(/\$HOME/g, home)
      .replace(/%USERPROFILE%/g, home)

  const resolved: Record<string, McpServerConfig> = {}
  for (const [name, cfg] of Object.entries(config)) {
    resolved[name] = {
      ...cfg,
      command: replacePlaceholders(cfg.command),
      args: cfg.args?.map(replacePlaceholders),
      cwd: cfg.cwd ? replacePlaceholders(cfg.cwd) : cfg.cwd,
    }
  }
  return resolved
}
