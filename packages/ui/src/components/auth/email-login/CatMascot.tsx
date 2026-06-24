import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface CatMascotProps {
  className?: string
  size?: number
}

export function CatMascot({ className, size = 200 }: CatMascotProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [eyeOffset, setEyeOffset] = useState({ lx: 0, ly: 0, rx: 0, ry: 0 })
  const [headTilt, setHeadTilt] = useState({ x: 0, y: 0 })
  const [floatOffset, setFloatOffset] = useState(0)
  const rafRef = useRef<number>(0)
  const targetRef = useRef({ lx: 0, ly: 0, rx: 0, ry: 0, tx: 0, ty: 0 })
  const currentRef = useRef({ lx: 0, ly: 0, rx: 0, ry: 0, tx: 0, ty: 0 })

  // Smooth float animation
  useEffect(() => {
    let start = performance.now()
    const animate = (now: number) => {
      const t = (now - start) / 1000
      setFloatOffset(Math.sin(t * 0.8) * 8 + Math.sin(t * 1.3) * 5)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2

      // Eye tracking: range within ±5px
      const maxEyeMove = 5
      const eyeX = ((e.clientX - cx) / (rect.width / 2)) * maxEyeMove
      const eyeY = ((e.clientY - cy) / (rect.height / 2)) * maxEyeMove

      // Head tilt: range within ±4deg
      const maxTilt = 4
      const tiltX = ((e.clientX - cx) / (rect.width / 2)) * maxTilt
      const tiltY = ((e.clientY - cy) / (rect.height / 2)) * maxTilt

      targetRef.current = {
        lx: Math.max(-maxEyeMove, Math.min(maxEyeMove, eyeX)),
        ly: Math.max(-maxEyeMove, Math.min(maxEyeMove, eyeY)),
        rx: Math.max(-maxEyeMove, Math.min(maxEyeMove, eyeX)),
        ry: Math.max(-maxEyeMove, Math.min(maxEyeMove, eyeY)),
        tx: Math.max(-maxTilt, Math.min(maxTilt, tiltX)),
        ty: Math.max(-maxTilt, Math.min(maxTilt, tiltY)),
      }
    }

    // Smooth interpolation
    let smoothRaf: number
    const smooth = () => {
      const ease = 0.08
      const c = currentRef.current
      const t = targetRef.current

      c.lx += (t.lx - c.lx) * ease
      c.ly += (t.ly - c.ly) * ease
      c.rx += (t.rx - c.rx) * ease
      c.ry += (t.ry - c.ry) * ease
      c.tx += (t.tx - c.tx) * ease
      c.ty += (t.ty - c.ty) * ease

      setEyeOffset({ lx: c.lx, ly: c.ly, rx: c.rx, ry: c.ry })
      setHeadTilt({ x: c.tx, y: c.ty })
      smoothRaf = requestAnimationFrame(smooth)
    }
    smoothRaf = requestAnimationFrame(smooth)

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(smoothRaf)
    }
  }, [])

  const s = size / 200

  return (
    <div
      ref={containerRef}
      className={cn('relative select-none cursor-default', className)}
      style={{ width: size, height: size * 0.85 }}
    >
      {/* 猫头容器 — 随鼠标微幅旋转 + 浮动 */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-transform duration-100 ease-out"
        style={{
          transform: `rotateX(${headTilt.y}deg) rotateY(${-headTilt.x}deg) translateY(${floatOffset}px)`,
          transformStyle: 'preserve-3d',
        }}
      >
        <svg
          viewBox="0 0 200 170"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: size, height: size * 0.85, filter: 'drop-shadow(0 4px 12px rgba(14,165,233,0.15))' }}
        >
          {/* ========== 耳朵 ========== */}
          {/* 左耳外 */}
          <path
            d="M38 52 L22 6 L59 36 Z"
            fill="url(#earGradL)"
            className="drop-shadow-sm"
          />
          {/* 左耳内 */}
          <path
            d="M41 46 L30 14 L55 37 Z"
            fill="#fbcfe8"
            opacity="0.5"
          />
          {/* 右耳外 */}
          <path
            d="M162 52 L178 6 L141 36 Z"
            fill="url(#earGradR)"
            className="drop-shadow-sm"
          />
          {/* 右耳内 */}
          <path
            d="M159 46 L170 14 L145 37 Z"
            fill="#fbcfe8"
            opacity="0.5"
          />

          {/* ========== 脸 ========== */}
          <ellipse cx="100" cy="90" rx="70" ry="62" fill="url(#faceGrad)" />
          {/* 脸颊亮光 */}
          <ellipse cx="100" cy="85" rx="58" ry="50" fill="url(#faceHighlight)" />

          {/* ========== 眼睛 ========== */}
          {/* 左眼白 */}
          <ellipse cx="78" cy="82" rx="14" ry="16" fill="white" className="drop-shadow-sm" />
          {/* 右眼白 */}
          <ellipse cx="122" cy="82" rx="14" ry="16" fill="white" className="drop-shadow-sm" />

          {/* 左瞳孔 */}
          <ellipse
            cx={78 + eyeOffset.lx * s}
            cy={82 + eyeOffset.ly * s}
            rx="7"
            ry="9"
            fill="#1e293b"
          />
          {/* 左瞳孔高光 */}
          <ellipse
            cx={78 + eyeOffset.lx * s + 2}
            cy={82 + eyeOffset.ly * s - 3}
            rx="3"
            ry="3.5"
            fill="white"
          />

          {/* 右瞳孔 */}
          <ellipse
            cx={122 + eyeOffset.rx * s}
            cy={82 + eyeOffset.ry * s}
            rx="7"
            ry="9"
            fill="#1e293b"
          />
          {/* 右瞳孔高光 */}
          <ellipse
            cx={122 + eyeOffset.rx * s + 2}
            cy={82 + eyeOffset.ry * s - 3}
            rx="3"
            ry="3.5"
            fill="white"
          />

          {/* ========== 鼻子 ========== */}
          <path
            d="M96 101 L100 107 L104 101 Z"
            fill="#f472b6"
            className="drop-shadow-sm"
          />

          {/* ========== 嘴 ========== */}
          <path
            d="M100 107 Q92 115 86 110"
            stroke="#94a3b8"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M100 107 Q108 115 114 110"
            stroke="#94a3b8"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />

          {/* ========== 胡须 ========== */}
          {/* 左胡须 */}
          <line x1="32" y1="92" x2="62" y2="98" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="30" y1="102" x2="60" y2="103" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="32" y1="112" x2="62" y2="108" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />
          {/* 右胡须 */}
          <line x1="168" y1="92" x2="138" y2="98" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="170" y1="102" x2="140" y2="103" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="168" y1="112" x2="138" y2="108" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />

          {/* ========== 腮红 ========== */}
          <ellipse cx="55" cy="100" rx="10" ry="6" fill="#fbcfe8" opacity="0.4" />
          <ellipse cx="145" cy="100" rx="10" ry="6" fill="#fbcfe8" opacity="0.4" />

          {/* ========== 项圈/铃铛 ========== */}
          <rect x="72" y="138" rx="4" ry="4" width="56" height="10" fill="url(#collarGrad)" opacity="0.8" />
          <circle cx="100" cy="150" r="6" fill="#fbbf24" className="drop-shadow-sm" />
          <circle cx="100" cy="150" r="3" fill="#fef3c7" />

          {/* ========== 渐变定义 ========== */}
          <defs>
            <linearGradient id="faceGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="60%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <radialGradient id="faceHighlight" cx="0.45" cy="0.35" r="0.6">
              <stop offset="0%" stopColor="white" stopOpacity="0.7" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="earGradL" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
            <linearGradient id="earGradR" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
            <linearGradient id="collarGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.8" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  )
}
