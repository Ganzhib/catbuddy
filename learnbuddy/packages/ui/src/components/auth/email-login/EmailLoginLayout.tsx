import type { ReactNode } from 'react'
import { AmbientBackground } from './AmbientBackground'
import { ViewportFitShell } from './ViewportFitShell'

export function EmailLoginLayout({
  children,
  fitKey,
}: {
  children: ReactNode
  fitKey?: string
}) {
  return (
    <div className="relative h-dvh max-h-dvh w-full overflow-hidden overscroll-none">
      <AmbientBackground />
      <ViewportFitShell fitKey={fitKey}>
        {children}
      </ViewportFitShell>
    </div>
  )
}
