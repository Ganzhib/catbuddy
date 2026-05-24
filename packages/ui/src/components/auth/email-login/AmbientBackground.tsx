import { cn } from '@/lib/utils'

function WavePattern({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      className={cn(className, flip && 'scale-x-[-1]')}
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0,160 C240,80 480,240 720,160 C960,80 1200,240 1440,160 L1440,320 L0,320 Z"
        fill="#0EA5E9"
      />
      <path
        d="M0,200 C360,120 540,260 900,200 C1080,160 1260,280 1440,220 L1440,320 L0,320 Z"
        fill="#2DD4BF"
        opacity="0.5"
      />
    </svg>
  )
}

export function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-br from-[#EFF6FF] via-[#E8F2FC] to-[#DBEAFE] dark:from-[#0c1929] dark:via-[#0e1f33] dark:to-[#0a1628]" />
      <WavePattern className="auth-wave-drift-a absolute -left-[10%] top-[18%] h-[420px] w-[120%] opacity-[0.035] dark:opacity-[0.06]" />
      <WavePattern className="auth-wave-drift-b absolute -right-[5%] bottom-[12%] h-[380px] w-[110%] opacity-[0.03] dark:opacity-[0.05]" flip />
      <div className="auth-orb-drift-a absolute -left-20 top-[15%] h-80 w-80 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />
      <div className="auth-orb-drift-b absolute right-[-5%] top-[8%] h-96 w-96 rounded-full bg-teal-200/30 blur-3xl dark:bg-teal-500/10" />
      <div className="auth-orb-drift-c absolute bottom-[-10%] left-[35%] h-72 w-72 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-400/10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(14,165,233,0.06),transparent_50%)]" />
    </div>
  )
}
