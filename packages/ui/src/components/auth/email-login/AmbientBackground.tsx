export function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* 基础底色：浅奶白 → 微暖 → 柔和天蓝；暗色模式为深蓝夜空 */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FBFDFF] via-[#F1F8FF] to-[#E6F2FF] dark:from-[#0b1622] dark:via-[#0d1c2e] dark:to-[#0a1424]" />

      {/* Linear 风细网格 — 顶部清晰、边缘渐隐 */}
      <div className="auth-grid absolute inset-0 opacity-70 dark:opacity-40" />

      {/* Stripe 风极光团 — 偏左更浓，呼应左侧品牌区；右侧暖色点缀补全色板 */}
      <div className="auth-aurora-blob left-[2%] top-[6%] h-[34rem] w-[34rem] bg-sky-300/50 dark:bg-sky-500/20" />
      <div className="auth-aurora-blob left-[24%] top-[38%] h-[26rem] w-[26rem] bg-teal-200/50 dark:bg-teal-500/15" style={{ animationDelay: '8s' }} />
      <div className="auth-aurora-blob left-[-6%] bottom-0 h-[28rem] w-[28rem] bg-cyan-200/45 dark:bg-cyan-500/12" style={{ animationDelay: '4s' }} />
      <div className="auth-aurora-blob right-[6%] top-[-2%] h-[30rem] w-[30rem] bg-orange-200/40 dark:bg-indigo-500/14" style={{ animationDelay: '6s' }} />
      <div className="auth-aurora-blob right-[14%] bottom-[6%] h-[22rem] w-[22rem] bg-rose-200/35 dark:bg-sky-500/12" style={{ animationDelay: '10s' }} />

      {/* 顶部高光细线 */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/50 to-transparent dark:via-sky-400/25" />
    </div>
  )
}
