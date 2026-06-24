export function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* 主页风格浅蓝渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#EFF6FF] via-[#E8F2FC] to-[#DBEAFE] dark:from-[#0c1929] dark:via-[#0e1f33] dark:to-[#0a1628]" />
      {/* 装饰性光晕 */}
      <div className="auth-orb-drift-a absolute -left-20 top-[15%] h-80 w-80 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/8" />
      <div className="auth-orb-drift-b absolute right-[-5%] top-[8%] h-96 w-96 rounded-full bg-teal-200/25 blur-3xl dark:bg-teal-500/6" />
      <div className="auth-orb-drift-c absolute bottom-[-10%] left-[35%] h-72 w-72 rounded-full bg-sky-300/15 blur-3xl dark:bg-sky-400/6" />
    </div>
  )
}
