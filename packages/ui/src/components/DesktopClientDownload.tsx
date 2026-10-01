import { Apple, ArrowDownToLine, Check, Cpu, Download, Laptop, MonitorDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { resolveDesktopDownloadUrl, shouldOfferDesktopDownload } from '@catbuddy/platform'

type DesktopClientDownloadProps = {
  /** sidebar: under search; login: marketing panel; banner: under offline hint */
  variant?: 'sidebar' | 'login' | 'banner'
  className?: string
  /** login variant only — hide helper text under the button */
  showHint?: boolean
  /** Optional copy override for prominent marketing CTAs. */
  triggerLabel?: string
}

export function DesktopClientDownload({
  variant = 'sidebar',
  className,
  showHint = true,
  triggerLabel,
}: DesktopClientDownloadProps) {
  const { t } = useTranslation()

  if (!shouldOfferDesktopDownload()) return null

  const hint = t('desktopDownload.hint')
  const label = triggerLabel || t('desktopDownload.experience')

  const trigger = variant === 'banner' ? (
    <button
      type="button"
      className={cn(
        'mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium',
        'bg-sky-500/12 text-sky-800 transition-colors hover:bg-sky-500/18',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/45 focus-visible:ring-offset-2',
        'dark:text-sky-200 dark:focus-visible:ring-offset-background',
        className,
      )}
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  ) : variant === 'login' ? (
    <button
      type="button"
      className={cn(
        'flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-medium',
        'bg-[#0EA5E9] text-white shadow-md shadow-sky-500/20 transition-all duration-200',
        'hover:bg-[#0284C7] hover:shadow-lg hover:shadow-sky-500/25',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-offset-2',
      )}
    >
      <MonitorDown className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </button>
  ) : (
    <button
      type="button"
      title={hint}
      className={cn(
        'flex h-9 w-full items-center justify-start gap-2.5 rounded-full px-3.5 text-[13px] font-medium',
        'text-sidebar-foreground/88 transition-colors',
        'hover:bg-sidebar-accent/75 hover:text-sidebar-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <Download className="h-4 w-4 shrink-0 text-[#4f9de8] dark:text-[#6eb3f5]" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  )

  return (
    <Dialog>
      {variant === 'login' ? (
        <div className={cn('mt-8', className)}>
          <DialogTrigger asChild>{trigger}</DialogTrigger>
          {showHint ? (
            <p className="mt-2 text-center text-xs leading-relaxed text-[#52647c] dark:text-slate-300">
              {hint}
            </p>
          ) : null}
        </div>
      ) : (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      )}
      <DesktopDownloadDialog />
    </Dialog>
  )
}

function DesktopDownloadDialog() {
  const { t } = useTranslation()
  const windowsHref = resolveDesktopDownloadUrl('windows')
  const macArmHref = resolveDesktopDownloadUrl('macArm64')
  const macIntelHref = resolveDesktopDownloadUrl('macX64')

  return (
    <DialogContent
      overlayClassName="bg-[#082f49]/30 backdrop-blur-md dark:bg-black/70"
      className={cn(
        'max-h-[calc(100vh-2rem)] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-[28px] border-0 p-0',
        'bg-[#f8fcff] text-[#10213d] shadow-[0_32px_90px_rgba(14,116,144,0.25)]',
        'ring-1 ring-inset ring-white/90 dark:bg-[#101927] dark:text-slate-50 dark:ring-white/10',
      )}
    >
      <div className="relative overflow-hidden rounded-t-[28px] border-b border-sky-900/10 px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7 dark:border-white/10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-sky-200/55 blur-3xl dark:bg-sky-500/10" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-44 w-44 rounded-full bg-teal-200/50 blur-3xl dark:bg-teal-400/10" />
        <DialogHeader className="relative pr-8 text-left">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/25">
            <Laptop className="h-5 w-5" aria-hidden />
          </div>
          <DialogTitle className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
            {t('desktopDownload.dialogTitle')}
          </DialogTitle>
          <DialogDescription className="max-w-[58ch] pt-1 text-[13px] leading-6 text-[#52647c] sm:text-sm dark:text-slate-300">
            {t('desktopDownload.dialogDescription')}
          </DialogDescription>
        </DialogHeader>
      </div>

      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-7 sm:pb-7">
        <a
          href={windowsHref}
          className={cn(
            'group flex min-h-[210px] flex-col rounded-[22px] border border-sky-900/10 bg-white p-5',
            'shadow-[0_12px_34px_rgba(14,116,144,0.08)] transition duration-200',
            'hover:-translate-y-0.5 hover:border-sky-400/50 hover:shadow-[0_18px_44px_rgba(14,165,233,0.14)]',
            'motion-reduce:transform-none motion-reduce:transition-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
            'dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-sky-400/45 dark:focus-visible:ring-offset-[#101927]',
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300">
              <MonitorDown className="h-5 w-5" aria-hidden />
            </span>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 dark:bg-sky-400/10 dark:text-sky-200">
              .exe · x64
            </span>
          </div>
          <h3 className="mt-5 text-lg font-semibold">Windows</h3>
          <p className="mt-1 text-[13px] leading-5 text-[#64748b] dark:text-slate-400">
            {t('desktopDownload.windowsMeta')}
          </p>
          <span className="mt-auto flex items-center justify-between pt-6 text-sm font-semibold text-sky-700 dark:text-sky-300">
            {t('desktopDownload.downloadWindows')}
            <ArrowDownToLine className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5" aria-hidden />
          </span>
        </a>

        <section className="flex min-h-[210px] flex-col rounded-[22px] border border-teal-900/10 bg-white p-5 shadow-[0_12px_34px_rgba(13,148,136,0.08)] dark:border-white/10 dark:bg-white/[0.045]">
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
              <Apple className="h-5 w-5" aria-hidden />
            </span>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700 dark:bg-teal-400/10 dark:text-teal-200">
              .dmg
            </span>
          </div>
          <h3 className="mt-5 text-lg font-semibold">macOS</h3>
          <div className="mt-3 space-y-2">
            <a
              href={macArmHref}
              className={cn(
                'group flex items-center justify-between gap-3 rounded-xl bg-teal-500 px-3.5 py-2.5 text-white transition-colors hover:bg-teal-600',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#101927]',
              )}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Cpu className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">Apple Silicon</span>
                  <span className="block text-[10px] text-white/75">M1 · M2 · M3 · M4</span>
                </span>
              </span>
              <ArrowDownToLine className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-y-0.5" aria-hidden />
            </a>
            <a
              href={macIntelHref}
              className={cn(
                'group flex items-center justify-between gap-3 rounded-xl border border-teal-900/10 px-3.5 py-2.5 text-[#315468] transition-colors',
                'hover:border-teal-400/45 hover:bg-teal-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
                'dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:focus-visible:ring-offset-[#101927]',
              )}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Cpu className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">Intel</span>
                  <span className="block text-[10px] text-[#718096] dark:text-slate-500">x64</span>
                </span>
              </span>
              <ArrowDownToLine className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-y-0.5" aria-hidden />
            </a>
          </div>
        </section>
      </div>

      <div className="mx-4 mb-5 flex items-start gap-2.5 rounded-2xl bg-sky-900/[0.035] px-3.5 py-3 text-[11px] leading-5 text-[#5f7188] sm:mx-7 sm:mb-7 dark:bg-white/[0.035] dark:text-slate-400">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
        <span>{t('desktopDownload.unsignedNote')}</span>
      </div>
    </DialogContent>
  )
}
