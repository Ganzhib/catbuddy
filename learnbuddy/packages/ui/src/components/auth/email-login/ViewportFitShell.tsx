import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export function ViewportFitShell({ children, fitKey }: { children: ReactNode; fitKey?: string }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const fit = () => {
      inner.style.transform = 'none'
      const neededH = inner.scrollHeight
      const neededW = inner.scrollWidth
      const availH = outer.clientHeight
      const availW = outer.clientWidth
      const next = Math.min(1, availH / neededH, availW / neededW)
      setScale(Number.isFinite(next) ? Math.max(0.72, next) : 1)
    }

    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(outer)
    ro.observe(inner)
    window.addEventListener('resize', fit)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [fitKey])

  return (
    <div
      ref={outerRef}
      className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden"
    >
      <div
        ref={innerRef}
        className="flex h-full w-full max-w-[100vw] origin-center"
        style={{ transform: scale < 1 ? `scale(${scale})` : undefined }}
      >
        {children}
      </div>
    </div>
  )
}
