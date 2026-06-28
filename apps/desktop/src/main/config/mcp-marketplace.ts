import type { McpMarketplaceEntry, McpServerConfig } from '@catbuddy/shared'

const homePlaceholder = process.platform === 'win32' ? '%USERPROFILE%' : '$HOME'

export const MCP_MARKETPLACE: McpMarketplaceEntry[] = [
  // ── 中国区 ──
  {
    id: 'feishu-lark',
    name: '飞书 / Lark',
    description: '官方 OpenAPI MCP：文档、消息、日历、多维表格等飞书开放平台能力。',
    category: '中国区',
    docsUrl: 'https://github.com/larksuite/lark-openapi-mcp',
    setupNote: '在飞书开放平台创建应用，获取 App ID 与 App Secret，添加后请在配置中替换 <FEISHU_APP_ID> 与 <FEISHU_APP_SECRET>。',
    config: {
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
    },
  },
  {
    id: 'feishu-doc',
    name: '飞书文档',
    description: '专注飞书云文档与知识库：Markdown 上传、读取、搜索、Wiki 管理。',
    category: '中国区',
    docsUrl: 'https://github.com/Hbin-Zhuang/mcp-feishu-doc',
    setupNote: '需配置飞书应用并完成 OAuth。首次使用请按文档完成授权流程。',
    config: {
      feishu_doc: {
        command: 'npx',
        args: ['-y', '@hibson/mcp-feishu-doc'],
      },
    },
  },
  {
    id: 'tencent-docs',
    name: '腾讯文档',
    description: '创建/编辑 Word、Excel、幻灯片、智能文档等；搜索空间、读取正文。',
    category: '中国区',
    docsUrl: 'https://docs.qq.com/open/document/mcp/',
    pasteOnly: true,
    setupNote:
      '腾讯文档为远程 HTTP MCP。当前 Desktop 仅支持 stdio，请复制下方配置到粘贴区，'
      + '待 HTTP 传输支持后即可连接。Token 获取：https://docs.qq.com/open/auth/mcp.html',
    pasteTemplate: JSON.stringify(
      {
        tencent_docs: {
          url: 'https://docs.qq.com/openapi/mcp',
          headers: { Authorization: '<your-token>' },
        },
      },
      null,
      2,
    ),
    config: {},
  },
  {
    id: 'bilibili',
    name: '哔哩哔哩',
    description: '搜索视频、查询 UP 主信息、通过 BV 号获取视频详情（公开 API，无需登录）。',
    category: '中国区',
    docsUrl: 'https://www.npmjs.com/package/@wangshunnn/bilibili-mcp-server',
    config: {
      bilibili: {
        command: 'npx',
        args: ['-y', '@wangshunnn/bilibili-mcp-server'],
      },
    },
  },
  {
    id: 'bilibili-upload',
    name: '哔哩哔哩（投稿）',
    description: 'B 站开放平台：OAuth 登录、视频管理、完整投稿流程。',
    category: '中国区',
    docsUrl: 'https://github.com/mcpcn/mcp-servers/tree/main/typescript/mcp-bilibili',
    setupNote: '需在 B 站开放平台创建应用。首次连接后按工具提示完成 OAuth 授权。',
    config: {
      bilibili_open: {
        command: 'npx',
        args: ['-y', '@mcpcn/mcp-bilibili'],
      },
    },
  },
  {
    id: 'xiaohongshu',
    name: '小红书',
    description: '搜索笔记、浏览推荐、发布图文/视频；基于 Playwright 浏览器自动化。',
    category: '中国区',
    docsUrl: 'https://github.com/ShunL12324/xhs-mcp',
    setupNote: '首次使用需扫码登录小红书。会自动下载 Chromium（Playwright）。',
    config: {
      xiaohongshu: {
        command: 'npx',
        args: ['-y', '@sillyl12324/xhs-mcp@latest'],
      },
    },
  },
  {
    id: 'xiaohongshu-redbook',
    name: '小红书（Redbook 版）',
    description: '另一款小红书 MCP：登录、发布、搜索、评论互动。',
    category: '中国区',
    docsUrl: 'https://github.com/adjfks/redbook-mcp',
    setupNote: '首次使用会打开浏览器窗口完成登录。可用 --headless false 调试。',
    config: {
      redbook: {
        command: 'npx',
        args: ['-y', 'redbook-mcp@latest'],
      },
    },
  },

  // ── 通用工具 ──
  {
    id: 'filesystem',
    name: '文件系统',
    description: '通过 MCP 读写指定目录下的文件与文件夹。',
    category: '效率工具',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    config: {
      filesystem: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', homePlaceholder],
      },
    },
  },
  {
    id: 'github',
    name: 'GitHub',
    description: '管理代码仓库、Issue 与 Pull Request。',
    category: '开发工具',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    requiresEnv: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    setupNote: '添加后请在配置 env 中填入 GitHub Personal Access Token。',
    config: {
      github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: '<your-token>' },
      },
    },
  },
  {
    id: 'brave-search',
    name: 'Brave 搜索',
    description: '通过 Brave Search API 进行网页搜索。',
    category: '搜索',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
    requiresEnv: ['BRAVE_API_KEY'],
    setupNote: '需在 Brave Search API 申请 Key，添加后替换 env 中的占位符。',
    config: {
      brave_search: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: { BRAVE_API_KEY: '<your-api-key>' },
      },
    },
  },
  {
    id: 'sequential-thinking',
    name: '顺序思考',
    description: '分步骤结构化推理，适合拆解复杂问题。',
    category: '效率工具',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
    config: {
      sequential_thinking: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      },
    },
  },
  {
    id: 'memory',
    name: '记忆',
    description: '为 Agent 提供持久化的键值记忆存储。',
    category: '效率工具',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    config: {
      memory: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
      },
    },
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
