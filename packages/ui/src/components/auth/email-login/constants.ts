import { Laptop, ShieldCheck, Sparkles } from 'lucide-react'

export const FEATURES = [
  {
    icon: Sparkles,
    title: '会动手帮你的助手',
    desc: '不只是聊天——它能查资料、读写文件、写代码、整理笔记，按步骤把学习任务做到底。',
  },
  {
    icon: Laptop,
    title: '网页遥控桌面',
    desc: '在浏览器提问，桌面应用替你执行；开启远程控制后，对话与进度实时同步，换设备也能接着聊。',
  },
  {
    icon: ShieldCheck,
    title: '本地执行更安心',
    desc: '助手在你的电脑上运行，学习与文件操作留在本机，同一账号可在网页继续对话。',
  },
] as const
