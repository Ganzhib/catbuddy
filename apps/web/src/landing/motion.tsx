import { cn } from '@/lib/utils'
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

const SCROLL_ROOT_ID = 'landing-scroll-root'

function getScrollRoot(): HTMLElement | null {
  return typeof document !== 'undefined' ? document.getElementById(SCROLL_ROOT_ID) : null
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

type RevealVariant = 'up' | 'left' | 'right' | 'scale' | 'blur'

/**
 * Scroll-triggered reveal. Starts hidden (see `[data-reveal]` in landing.css)
 * and flips to `.is-visible` once it enters the landing scroll container.
 * Fires once, then disconnects. Honors prefers-reduced-motion via CSS.
 */
export function Reveal({
  children,
  className,
  variant = 'up',
  delay = 0,
  y,
  id,
  style,
}: {
  children: ReactNode
  className?: string
  variant?: RevealVariant
  /** stagger delay in ms */
  delay?: number
  /** travel distance for the default `up` variant, in px */
  y?: number
  id?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || shown) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { root: getScrollRoot(), threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [shown])

  return (
    <div
      ref={ref}
      id={id}
      data-reveal={variant}
      className={cn(shown && 'is-visible', className)}
      style={
        {
          '--reveal-delay': `${delay}ms`,
          ...(y != null ? { '--reveal-y': `${y}px` } : {}),
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  )
}

/** Scroll progress 0..1 of the landing scroll container (for the top bar). */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const root = getScrollRoot()
    if (!root) return
    let frame = 0
    const update = () => {
      frame = 0
      const max = root.scrollHeight - root.clientHeight
      setProgress(max > 0 ? Math.min(1, Math.max(0, root.scrollTop / max)) : 0)
    }
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(update)
    }
    update()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return progress
}

/** True once the landing scroll container has scrolled past `threshold` px. */
export function useScrolled(threshold = 12): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const root = getScrollRoot()
    if (!root) return
    const onScroll = () => setScrolled(root.scrollTop > threshold)
    onScroll()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [threshold])
  return scrolled
}

/**
 * Pointer-driven 3D tilt. Spread the returned handlers on a `.landing-tilt`
 * element; it writes `--tx`/`--ty` CSS vars consumed by the transform.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(max = 8) {
  const ref = useRef<T | null>(null)

  const onPointerMove = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const el = ref.current
      if (!el || prefersReducedMotion()) return
      const rect = el.getBoundingClientRect()
      const px = (event.clientX - rect.left) / rect.width - 0.5
      const py = (event.clientY - rect.top) / rect.height - 0.5
      el.style.setProperty('--tx', `${(px * max).toFixed(2)}deg`)
      el.style.setProperty('--ty', `${(-py * max).toFixed(2)}deg`)
    },
    [max],
  )

  const onPointerLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--tx', '0deg')
    el.style.setProperty('--ty', '0deg')
  }, [])

  return { ref, onMouseMove: onPointerMove, onMouseLeave: onPointerLeave }
}

/**
 * Magnetic pull toward the cursor. Spread on a `.landing-magnetic` element
 * (works for `<a>`/`<button>`); translates the element a fraction of the
 * cursor offset, snapping back on leave.
 */
export function useMagnetic<T extends HTMLElement = HTMLAnchorElement>(strength = 0.35) {
  const ref = useRef<T | null>(null)

  const onMouseMove = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const el = ref.current
      if (!el || prefersReducedMotion()) return
      const rect = el.getBoundingClientRect()
      const x = (event.clientX - rect.left - rect.width / 2) * strength
      const y = (event.clientY - rect.top - rect.height / 2) * strength
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
    },
    [strength],
  )

  const onMouseLeave = useCallback(() => {
    const el = ref.current
    if (el) el.style.transform = 'translate(0, 0)'
  }, [])

  return { ref, onMouseMove, onMouseLeave }
}
