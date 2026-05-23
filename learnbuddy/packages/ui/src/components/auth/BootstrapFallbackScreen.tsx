import { Loader2, RefreshCw, ServerCrash, WifiOff } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const authPrimaryBtn = cn(
  'rounded-lg bg-gradient-to-r from-[#FF6B35] to-[#FFA62E] text-white shadow-lg shadow-orange-500/30',
  'hover:from-[#F05A28] hover:to-[#FF9620] hover:shadow-xl hover:shadow-orange-500/40 transition-all duration-200',
)

export function BootstrapLoadingScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <BrandMark className="h-12 w-12 object-contain opacity-90" />
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          正在连接 learnbuddy…
        </div>
      </div>
    </div>
  )
}

function connectionTips(error: string): string[] {
  const tips: string[] = []
  const lower = error.toLowerCase()
  if (lower.includes('500') || lower.includes('502') || lower.includes('503')) {
    tips.push('服务端可能尚未就绪，稍等几秒后重试。')
  }
  if (lower.includes('fetch') || lower.includes('network') || lower.includes('failed to fetch')) {
    tips.push('请确认网络正常，且 Gateway 地址可访问。')
  }
  if (lower.includes('not_found') || lower.includes('gateway')) {
    tips.push('开发模式下请先启动 Gateway：pnpm gateway:dev')
  }
  if (tips.length === 0) {
    tips.push('请确认 learnbuddy 桌面端或 Gateway 服务正在运行。')
  }
  return tips
}

export function BootstrapErrorScreen({
  error,
  onRetry,
}: {
  error: string
  onRetry: () => void
}) {
  const tips = connectionTips(error)

  return (
    <div className="flex h-full w-full items-center justify-center px-6 py-10">
      <div className="w-full max-w-[440px] rounded-2xl border border-border bg-card p-8 shadow-lg sm:p-9">
        <div className="mx-auto mb-6 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-orange-50 shadow-inner dark:border-red-500/20 dark:from-red-500/15 dark:to-orange-500/10">
          <WifiOff className="h-8 w-8 text-[#E85A28]" strokeWidth={1.75} />
        </div>

        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
          连接异常
        </p>
        <h1 className="mt-3 text-center text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]">
          无法连接到服务
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
          应用暂时无法与 learnbuddy 后端建立连接，请检查服务状态后重试。
        </p>

        <ul className="mt-6 space-y-2">
          {tips.map((tip) => (
            <li
              key={tip}
              className="flex items-start gap-2.5 rounded-lg border border-orange-100 bg-orange-50/80 px-3.5 py-2.5 text-xs leading-relaxed text-gray-600 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-muted-foreground"
            >
              <ServerCrash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6B35]" strokeWidth={2} />
              {tip}
            </li>
          ))}
        </ul>

        <details className="group mt-5">
          <summary className="cursor-pointer list-none text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <span className="underline decoration-dotted underline-offset-2 group-open:hidden">
              查看错误详情
            </span>
            <span className="hidden underline decoration-dotted underline-offset-2 group-open:inline">
              收起错误详情
            </span>
          </summary>
          <pre className="mt-3 max-h-32 overflow-auto rounded-lg border border-border bg-muted/50 px-3.5 py-3 text-left font-mono text-[11px] leading-relaxed text-muted-foreground">
            {error}
          </pre>
        </details>

        <Button
          type="button"
          size="lg"
          className={cn('mt-6 w-full', authPrimaryBtn)}
          onClick={onRetry}
        >
          <RefreshCw className="mr-2 h-4 w-4" strokeWidth={2} />
          重新连接
        </Button>

        <div className="mt-6 flex items-center justify-center gap-2 border-t border-border pt-5">
          <BrandMark className="h-5 w-5 object-contain opacity-80" />
          <span className="text-xs font-medium text-muted-foreground">
            learnbuddy
          </span>
        </div>
      </div>
    </div>
  )
}
