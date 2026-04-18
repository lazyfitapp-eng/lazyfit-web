'use client'

import { useEffect, useRef } from 'react'

// ─── Fitness-themed character pool ───────────────────────────────────────────
// Weighted so single chars dominate (Matrix feel), longer terms appear as glitches
const CHARS: string[] = [
  // Digits — backbone of Matrix aesthetic (4× weight)
  '0','0','0','0',
  '1','1','1','1',
  '2','2','2','2',
  '3','3','3','3',
  '4','4','4','4',
  '5','5','5','5',
  '6','6','6','6',
  '7','7','7','7',
  '8','8','8','8',
  '9','9','9','9',
  // Single-letter macro/fitness codes (3× weight)
  'P','P','P',   // Protein
  'C','C','C',   // Carbs
  'F','F','F',   // Fat
  'R','R','R',   // Reps
  'S','S',       // Sets
  'W','W',       // Weight
  'X','X',       // Multiplier (3×5 notation)
  // 2–3 char tokens (2× weight)
  'PR','PR',     // Personal Record
  'RM','RM',     // Rep Max
  'KG','KG',     // Kilograms
  'LB','LB',     // Pounds
  'BF','BF',     // Body Fat
  'HR',          // Heart Rate
  'VO',          // VO2
  '1R',          // 1RM shorthand
  '5X',          // 5×5 notation
  'RPE','RPE',   // Rate of Perceived Exertion
  '1RM',         // 1 Rep Max
  // Rare glitch words — single entry each
  'KCAL',
  'SQUAT',
  'BENCH',
  'PRESS',
  'PROTEIN',
  'DEFICIT',
  'SURPLUS',
  'CALORIES',
  'MACROS',
]

// ─── Color palette ───────────────────────────────────────────────────────────
const COLOR_HEAD   = '#E0FFE8' // Bright white-green cursor tip
const COLOR_BRIGHT = '#00FF41' // Full Matrix green
const COLOR_MID    = '#00CC33' // Dimmer green
const COLOR_TAIL   = '#003300' // Deep fading green
// Low alpha = long trail (20 frames at 60fps). Raise to 0.08 for snappier trail.
const BG_ALPHA     = 'rgba(0, 0, 0, 0.05)'

// ─── Column state ────────────────────────────────────────────────────────────
interface Column {
  y: number        // current y position in pixels
  speed: number    // pixels per frame
  chars: string[]  // pre-generated character stream for this column
  charIdx: number  // position in chars array
  opacity: number  // per-column variation (0.4–1.0)
}

function makeCharStream(len: number): string[] {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)])
}

function makeColumn(canvasHeight: number): Column {
  return {
    y: Math.random() * -canvasHeight,
    speed: 1.5 + Math.random() * 3,
    chars: makeCharStream(40),
    charIdx: 0,
    opacity: 0.4 + Math.random() * 0.6,
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
interface MatrixRainProps {
  /** Overall opacity multiplier. Default 1. Login page uses ~0.12. */
  opacity?: number
  className?: string
}

export default function MatrixRain({ opacity = 1, className = '' }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Respect OS reduced-motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const ctxEl = canvasEl.getContext('2d')
    if (!ctxEl) return
    // Use definitely-typed aliases so TS closures (resize, draw) don't lose narrowing
    const canvas: HTMLCanvasElement = canvasEl
    const ctx: CanvasRenderingContext2D = ctxEl

    const FONT_SIZE = 14
    const COL_WIDTH = FONT_SIZE

    let columns: Column[] = []
    let rafId: number

    function resize() {
      const parent = canvas.parentElement
      if (!parent) return
      canvas.width  = parent.offsetWidth
      canvas.height = parent.offsetHeight
      const count = Math.floor(canvas.width / COL_WIDTH)
      columns = Array.from({ length: count }, () => makeColumn(canvas.height))
    }

    resize()

    const observer = new ResizeObserver(resize)
    if (canvas.parentElement) observer.observe(canvas.parentElement)

    function draw() {
      const W = canvas.width
      const H = canvas.height

      // Semi-transparent overlay creates the fading trail effect
      ctx.fillStyle = BG_ALPHA
      ctx.fillRect(0, 0, W, H)

      ctx.textAlign = 'center'

      columns.forEach((col, i) => {
        const x = i * COL_WIDTH + COL_WIDTH / 2
        const ratio = col.y / H // 0 = top, 1 = bottom

        // Color grade by vertical position
        const color =
          ratio < 0.05 ? COLOR_HEAD :
          ratio < 0.3  ? COLOR_BRIGHT :
          ratio < 0.7  ? COLOR_MID :
          COLOR_TAIL

        ctx.globalAlpha = col.opacity * opacity

        const char = col.chars[col.charIdx % col.chars.length]

        // Scale font for multi-char tokens so they fit the column width
        if (char.length > 4) {
          ctx.font = `bold ${Math.floor(FONT_SIZE * 0.55)}px "Geist Mono", monospace`
        } else if (char.length > 2) {
          ctx.font = `bold ${Math.floor(FONT_SIZE * 0.75)}px "Geist Mono", monospace`
        } else {
          ctx.font = `bold ${FONT_SIZE}px "Geist Mono", monospace`
        }

        ctx.fillStyle = color
        ctx.fillText(char, x, col.y)

        col.y += col.speed

        // Advance character every ~8 pixels
        if (col.y % (FONT_SIZE * 0.6) < col.speed) {
          col.charIdx++
          // Occasional glitch mutation (2% chance)
          if (Math.random() < 0.02) {
            const idx = Math.floor(Math.random() * col.chars.length)
            col.chars[idx] = CHARS[Math.floor(Math.random() * CHARS.length)]
          }
        }

        // Reset column when fully off-screen
        if (col.y > H + FONT_SIZE * 2) {
          Object.assign(col, makeColumn(H))
        }
      })

      ctx.globalAlpha = 1
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [opacity])

  return (
    <div
      className={`absolute inset-0 -z-10 overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  )
}
