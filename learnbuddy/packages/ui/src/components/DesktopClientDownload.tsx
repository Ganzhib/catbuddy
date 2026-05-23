import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { resolveDesktopDownloadUrl, shouldOfferDesktopDownload } from '@learnbuddy/platform'

type DesktopClientDownloadProps = {
  /** sidebar: under search; login: marketing panel; banner: under offline hint */
  variant?: 'sidebar' | 'login' | 'banner'
  className?: string
}

export function DesktopClientDownload({
  variant = 'sidebar',
  className,
}: DesktopClientDownloadProps) {
  const { t } = useTranslation()

  if (!shouldOfferDesktopDownload()) return null

  const href = resolveDesktopDownloadUrl()
  const label = t('desktopDownload.label')
  const hint = t('desktopDownload.hint')

  if (variant === 'banner') {
    return (
      <a
        href={href}
        download
        className={cn(
          'mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium',
          'bg-sky-500/12 text-sky-800 hover:bg-sky-500/18 dark:text-sky-200',
          className,
        )}
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        {label}
      </a>
    )
  }

  if (variant === 'login') {
    return (
      <div className={cn('mt-8', className)}>
        <a
          href={href}
          download
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium',
            'bg-[hsl(220_38%_28%)] text-[hsl(210_40%_98%)] shadow-md',
            'hover:bg-[hsl(220_38%_24%)]',
          )}
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          {label}
        </a>
        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground/80">{hint}</p>
      </div>
    )
  }

  return (
    <a
      href={href}
      download
      title={hint}
      className={cn(
        'flex h-9 w-full items-center justify-start gap-2.5 rounded-full px-3.5 text-[13px] font-medium',
        'text-sidebar-foreground/88 transition-colors',
        'hover:bg-sidebar-accent/75 hover:text-sidebar-foreground',
        className,
      )}
    >
      <Download className="h-4 w-4 shrink-0 text-[#4f9de8] dark:text-[#6eb3f5]" aria-hidden />
      <span className="truncate">{label}</span>
    </a>
  )
}
