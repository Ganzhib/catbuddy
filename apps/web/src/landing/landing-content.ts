import { FEATURES } from '@/components/auth/email-login/constants'

export const LANDING_VIDEO_SRC = '/video/catbuddy.mp4'

export const LANDING_COPY = {
  badge: '每一步，都算数 ✦',
  headline: '养一只 catbuddy',
  story:
    '养一只猫，它会在你疲惫时安静地靠进怀里，用呼噜声驱散孤独；也会在你无聊时发起「狩猎」，用一根逗猫棒让你开怀大笑。',
  punchline: '它不只是宠物，更是驻家的「情绪治疗师」，与随叫随到的「全能助理」。',
  videoCaption: '看它如何陪你学习、帮你动手',
  roles: [
    {
      title: '情绪治疗师',
      desc: '疲惫时有回应，孤独时有陪伴。像呼噜声一样温柔的学习搭子，随时待命。',
    },
    {
      title: '全能助理',
      desc: '不只是聊天——查资料、读写文件、写代码、整理笔记，按步骤把任务做到底。',
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
  author: {
    name: '甘智斌',
    handle: 'ganzhibin',
    /** 可将作者照片放到 apps/web/public/brand/author.webp */
    avatar: '/avatar/image.png',
    avatarFallback: '/brand/catbuddy_icon.png',
    bio: [
      'Hi ~  我是 catbuddy 的开发者，相信好的工具应该像猫一样——安静陪伴，也能在需要时真正帮上忙。',
      '这个项目从个人学习场景出发：让 AI 不只会聊天，还能在本地动手执行；网页随时接入，换设备也能接着学。',
      '欢迎邮箱交流 ，或在博客里看更多思考与更新。',
    ],
    links: [
      { label: 'Gitee', href: 'https://gitee.com/luli1314520' },
      { label: 'Blog', href: 'https://resume.ganzhibin.icu/' },
      {label: '稀土掘金', href: 'https://juejin.cn/column/7642179319759011859'},
    ],
  },
} as const

export { FEATURES as LANDING_FEATURES }
