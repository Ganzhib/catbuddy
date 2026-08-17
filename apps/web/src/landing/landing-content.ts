import {
  Blocks,
  Cpu,
  FolderLock,
  FolderTree,
  KeyRound,
  MessageSquareText,
  MonitorSmartphone,
  Wand2,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

export const LANDING_VIDEO_SRC = '/video/catbuddy.mp4'

export type LandingAuthor = {
  name: string
  handle: string
  role: string
  /** Photo path (public/) or remote URL. Falls back to `avatarFallback` on error. */
  avatar: string
  avatarFallback: string
  bio: string
  email?: string
  links: { label: string; href: string }[]
}

export const LANDING_COPY = {
  badge: '本地 AI 伙伴 · 跨端遥控 ✦',

  // Layered hero: the headline says what it *is*, the cat says how it *feels*.
  headlineLead: '养一只catbuddy',
  headlineAccent: '会动手的 AI 伙伴',
  subhead:
    '它就跑在你自己的电脑上——读写文件、调用工具、写代码，一步步把活干完。手机或浏览器，随时远程指挥。',
  punchline: '像猫一样安静陪伴，也像猫一样，在你需要时真正帮上忙。',

  trustChips: ['本地执行', '自带 API Key', '数据不出本机'],
  heroBadges: ['本地运行', 'MCP', 'Skill', '跨端同步'],
  videoCaption: '看它如何陪你学习、帮你动手',

  // Seamless marquee strip under the hero.
  marquee: [
    '本地执行',
    '文件不出机器',
    '自带 API Key',
    'MCP 市场',
    'Skill 市场',
    '工作空间隔离',
    '网页遥控桌面',
    'AI 画架构图',
    '同一邮箱配对',
    '热重载技能',
  ],

  // "Why local" — the strongest, most differentiated selling point.
  trust: {
    title: '为什么是「本地」？',
    sub: '把 Agent 留在你的机器上，能力不打折，数据不外流。',
    pillars: [
      {
        icon: Cpu as LucideIcon,
        title: '本地执行',
        desc: 'Agent 在你电脑上运行，文件读写、工具调用都留在本机，从不偷偷上传。',
      },
      {
        icon: FolderLock as LucideIcon,
        title: '工作空间隔离',
        desc: '每个文件夹独立授权，自动生成 .catbuddy 配置，AI 不会越界乱翻别处。',
      },
      {
        icon: KeyRound as LucideIcon,
        title: '自带 API Key',
        desc: '用你自己的 AI 提供商，用量和数据你说了算，不经过任何中间商。',
      },
    ],
  },

  // The six real capabilities, shown in an interactive tabbed showcase.
  // `media` is a placeholder image — replace with a real screenshot or GIF
  // (e.g. '/showcase/chat.gif'); 16:10 ratio looks best in the stage frame.
  capabilities: [
    {
      icon: MessageSquareText as LucideIcon,
      tag: '对话',
      title: '智能对话',
      desc: 'Plan · Analyze · Brainstorm · Code · Summarize，六种快速操作，从规划到编码一气呵成。',
      media: '/showcase/ai-chat.png',
    },
    {
      icon: Workflow as LucideIcon,
      tag: '可视化',
      title: '画架构图',
      desc: 'AI 分析代码，自动生成 System / 微服务 / 数据流 / 部署 / 模块 五类 Draw.io 架构图。',
      media: '/showcase/draw.png',
    },
    {
      icon: Blocks as LucideIcon,
      tag: '生态',
      title: 'MCP 市场',
      desc: '一键接入 GitHub 等 MCP 服务，粘贴 JSON 配置即时生效，无需重启。',
      media: '/showcase/mcp-market.png',
    },
    {
      icon: Wand2 as LucideIcon,
      tag: '生态',
      title: 'Skill 市场',
      desc: '一键安装技能包，启用 / 禁用热重载，下一条消息即可生效。',
      media: '/showcase/skill-market.png',
    },
    {
      icon: FolderTree as LucideIcon,
      tag: '安全',
      title: '工作空间',
      desc: '上传文件夹，自动创建 .catbuddy 配置，AI 在授权目录里安全操作。',
      media: '/showcase/workspace.png',
    },
    {
      icon: MonitorSmartphone as LucideIcon,
      tag: '协同',
      title: '跨端协同',
      desc: '桌面运行 Agent，浏览器 / 手机远程控制，同一邮箱自动配对，进度实时同步。',
      media: '/showcase/remote.png',
    },
  ],

  steps: [
    {
      step: '01',
      title: '下载桌面端',
      desc: '安装 Windows 客户端，让助手在你的电脑上本地运行。',
    },
    {
      step: '02',
      title: '同一邮箱登录',
      desc: '网页端与桌面端共用一套账号，对话与进度无缝衔接。',
    },
    {
      step: '03',
      title: '开启远程控制',
      desc: '在桌面侧边栏打开 Remote control，浏览器即可遥控执行。',
    },
  ],

  ctaTitle: '准备好迎接你的 catbuddy 了吗？',
  ctaSub: '下载桌面端，登录网页，随时随地继续你的学习之旅。',
  downloadHint: '安装后使用与网页相同的邮箱登录，并在侧栏开启「远程控制」。',

  // "关于我们" — team-first. Add entries to `authors` and the grid scales.
  team: {
    title: '关于我们',
    sub: '一群相信「好工具该像猫一样」的人——安静陪伴，也能在你需要时真正帮上忙。',
  },
  authors: [
    {
      name: '甘智斌',
      handle: '@Ganzhib',
      role: '发起者 · 全栈',
      avatar: '/avatar/ganzhibin.png',
      avatarFallback: '/brand/catbuddy_icon.png',
      bio: 'catbuddy 的开发者。让 AI 不只会聊天，还能在本地动手执行；网页随时接入，换设备也能接着学。',
      email: 'luli_0819@qq.com',
      links: [
        { label: 'Gitee', href: 'https://gitee.com/luli1314520' },
        { label: 'Blog', href: 'https://resume.ganzhibin.icu/' },
        { label: '稀土掘金', href: 'https://juejin.cn/column/7642179319759011859' },
      ],
    },
    {
      name: '过宇鑫 · 全栈',
      handle: '@guoyuxin',
      role: '开发者',
      avatar: '/avatar/guoyuxin.png',
      avatarFallback: '/brand/catbuddy_icon.png',
      bio: '用工程化的方式打磨细节，一起把 catbuddy 养大。',
      links: [{ label: 'GitHub', href: 'https://github.com' }],
    },
    {
      name: '李庆援 · 全栈',
      handle: '@Objecteee',
      role: '开发者',
      avatar:'/avatar/liqingyuan.png',
      avatarFallback: '/brand/catbuddy_icon.png',
      bio: '相信好的工具应该像猫一样安静陪伴，一起把 catbuddy 养大。',
      links: [{ label: 'GitHub', href: 'https://github.com' }],
    },
    {
      name: '王博杨 · 全栈',
      handle: '@WildBule',
      role: '开发者',
      avatar: '/avatar/wangboyang.png',
      avatarFallback: '/brand/catbuddy_icon.png',
      bio: '让 AI 伙伴在本地跑得又快又稳，一起把 catbuddy 养大。',
      links: [{ label: 'GitHub', href: 'https://github.com' }],
    },
    {
      name: '李嘉敏 · 全栈',
      handle: '@THE-4545',
      role: '开发者',
      avatar:'/avatar/lijiaming.png',
      avatarFallback: '/brand/catbuddy_icon.png',
      bio: '把复杂留给自己，把简单留给用户，一起把 catbuddy 养大。',
      links: [{ label: 'GitHub', href: 'https://github.com' }],
    }
  ] as LandingAuthor[],
  // Tasteful ghost card that shows the multi-author layout and invites contributors.
  joinCard: {
    title: '虚位以待',
    desc: '下一位作者，会是你吗？欢迎一起把 catbuddy 养大。',
    cta: '加入我们',
    href: 'mailto:luli_0819@qq.com',
  },

  // 致谢。
  acknowledgements: {
    title: '致谢',
    sub: '站在巨人的肩膀上。catbuddy 的设计与实现，离不开这些优秀开源项目的启发。',
    projects: [
      { name: 'nanobot', desc: '本地优先的 Agent 思路与简洁工具调用设计上的启发。', href: 'https://github.com/HKUDS/nanobot' },
      { name: 'openclaw', desc: '开源协作方式与工程组织结构上的参考。', href: 'https://openclaw.ai/' },
      { name: 'workbuddy', desc: '「助手即伙伴」产品理念上的共鸣。', href: 'https://www.workbuddy.ai/?fromSource=gwzcw.14729124.14729124.14729124&utm_medium=cpc&utm_id=gwzcw.14729124.14729124.14729124&gad_source=1&gad_campaignid=23882615670&gbraid=0AAAABCVWjqH4nNxkmjyEVdR62j1RmBXue&gclid=Cj0KCQjwjIPSBhCCARIsABGyK7vVhzaSj4PxzM3Mp2QqcsMF0tSbyLqQ3pOu07ce5Hxt7CQJHCLwoyoaAu8OEALw_wcB' },
    ],
    techStack: [
      { name: 'Electron', desc: '跨平台桌面应用框架，让 Web 技术拥有本地文件系统能力。', href: 'https://www.electronjs.org/' },
      { name: 'React', desc: '声明式 UI 库，驱动桌面端渲染进程与网页端界面。', href: 'https://react.dev/' },
      { name: 'TypeScript', desc: '类型安全的 JavaScript 超集，全栈类型系统的基石。', href: 'https://www.typescriptlang.org/' },
      { name: 'Vite', desc: '极速前端构建工具，开发体验顺滑如一。', href: 'https://vitejs.dev/' },
      { name: 'Tailwind CSS', desc: '实用优先的 CSS 框架，快速打磨精致 UI。', href: 'https://tailwindcss.com/' },
      { name: 'Radix UI', desc: '无样式无障碍组件库，交互与键盘导航的基石。', href: 'https://www.radix-ui.com/' },
      { name: 'Fastify', desc: '高性能 Node.js Web 框架，支撑 Gateway 中继服务。', href: 'https://fastify.dev/' },
      { name: 'Lucide', desc: '干净一致的图标库，遍布 catbuddy 各个角落。', href: 'https://lucide.dev/' },
      { name: 'pnpm', desc: '高效的包管理工具，让 monorepo 运作井井有条。', href: 'https://pnpm.io/' },
      { name: 'Zod', desc: 'TypeScript 优先的 schema 校验库，协议定义的可靠保障。', href: 'https://zod.dev/' },
      { name: 'Langfuse', desc: 'LLM 可观测性平台，追踪每一次 AI 调用的全链路。', href: 'https://langfuse.com/' },
      { name: 'Docker', desc: '容器化部署方案，让 Gateway 与数据库一键启动。', href: 'https://www.docker.com/' },
    ],
  },
} as const
