import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { usePeek } from './PeekContext'

const CHARS = [
  { label: 'yellow', color: '#FDE047', h: 80,  w: 64,  eyeY: 30 },
  { label: 'black',  color: '#1E293B', h: 110, w: 50,  eyeY: 34 },
  { label: 'green',  color: '#4ADE80', h: 115, w: 50,  eyeY: 35 },
  { label: 'purple', color: '#8B5CF6', h: 118, w: 52,  eyeY: 36 },
  { label: 'orange', color: '#FB923C', h: 72,  w: 68,  eyeY: 28 },
]

function CharSVG({
  cfg,
  px,
  py,
  blinking,
}: {
  cfg: typeof CHARS[number]
  px: number
  py: number
  blinking: boolean
}) {
  const { w, h, color, eyeY } = cfg
  const isDome = cfg.label === 'yellow' || cfg.label === 'orange'
  const eyeLX = Math.round(w * 0.32)
  const eyeRX = Math.round(w * 0.68)
  const eyeR  = Math.round(h * 0.11)
  const pupilR = Math.round(eyeR * 0.45)
  const mouthY = Math.round(h * 0.55)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" style={{ overflow: 'visible' }}>
      {/* 身体 — 固定不动 */}
      {isDome ? (
        <path
          d={`M2 ${h} L2 ${h * 0.35} Q2 ${h * 0.12} ${w / 2} ${h * 0.12} Q${w - 2} ${h * 0.12} ${w - 2} ${h * 0.35} L${w - 2} ${h} Z`}
          fill={color}
        />
      ) : (
        <rect x="2" y="2" width={w - 4} height={h - 4} rx="8" fill={color} />
      )}

      {/* 眼睛 — blinking 时闭合 */}
      <ellipse cx={eyeLX} cy={eyeY} rx={eyeR} ry={blinking ? 0.5 : eyeR * 1.15} fill="white" style={{ transition: 'ry 0.08s' }} />
      <ellipse cx={eyeRX} cy={eyeY} rx={eyeR} ry={blinking ? 0.5 : eyeR * 1.15} fill="white" style={{ transition: 'ry 0.08s' }} />
      {!blinking && (
        <>
          <circle cx={eyeLX + px} cy={eyeY + py} r={pupilR} fill="#1E293B" />
          <circle cx={eyeRX + px} cy={eyeY + py} r={pupilR} fill="#1E293B" />
        </>
      )}

      {/* 嘴巴 */}
      <line
        x1={Math.round(w * 0.35)} y1={mouthY}
        x2={Math.round(w * 0.65)} y2={mouthY}
        stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  )
}

export function WigglyFigures({ className }: { className?: string }) {
  const contRef = useRef<HTMLDivElement>(null)
  const [pupil, setPupil] = useState({ x: 0, y: 0 })
  const [blinks, setBlinks] = useState(CHARS.map(() => false))
  const mouseRef = useRef({ x: 0, y: 0 })
  const smoothRef = useRef({ x: 0, y: 0 })
  const { peeking } = usePeek()

  // 鼠标追踪
  useEffect(() => {
    const onMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY } }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!mq.matches) window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // 瞳孔平滑 + 挤在一起
  useEffect(() => {
    let raf: number
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const ease = 0.06
      const maxEye = 4
      smoothRef.current.x += (Math.max(-maxEye, Math.min(maxEye, ((mouseRef.current.x - window.innerWidth / 2) / (window.innerWidth / 2)) * maxEye)) - smoothRef.current.x) * ease
      smoothRef.current.y += (Math.max(-maxEye, Math.min(maxEye, ((mouseRef.current.y - window.innerHeight / 2) / (window.innerHeight / 2)) * maxEye)) - smoothRef.current.y) * ease
      setPupil({ ...smoothRef.current })
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // 点击小人 → 闭眼 200ms
  const onCharClick = useCallback((i: number) => {
    setBlinks((prev) => {
      const next = [...prev]
      next[i] = true
      return next
    })
    setTimeout(() => {
      setBlinks((prev) => {
        const next = [...prev]
        next[i] = false
        return next
      })
    }, 200)
  }, [])

  return (
    <div ref={contRef} className={cn('flex items-end justify-center', className)} aria-hidden>
      <div className={cn('flex items-end transition-all duration-500 ease-out', peeking ? 'gap-0.5' : 'gap-2 sm:gap-3')}>
        {CHARS.map((cfg, i) => (
          <div
            key={cfg.label}
            className="shrink-0 cursor-pointer pointer-events-auto transition-transform duration-500 ease-out"
            style={{
              height: cfg.h,
              width: cfg.w,
              transform: peeking ? `translateY(${[0, -6, -10, -4, 0][i]}px)` : 'translateY(0)',
            }}
            onClick={() => onCharClick(i)}
          >
            <CharSVG cfg={cfg} px={pupil.x} py={pupil.y} blinking={blinks[i]} />
          </div>
        ))}
      </div>
    </div>
  )
}
