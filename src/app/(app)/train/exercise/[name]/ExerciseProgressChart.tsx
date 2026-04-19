'use client'

import { useState } from 'react'

export interface ChartPoint {
  date: Date
  est1RM: number
  isPR: boolean
}

interface Props {
  points: ChartPoint[]
  accentColor: string
  cardBg: string
}

type Range = '4W' | '8W' | '3M' | '6M' | 'All'

const CUTOFF_DAYS: Record<Range, number> = {
  '4W': 28,
  '8W': 56,
  '3M': 90,
  '6M': 180,
  All: Infinity,
}

const RANGES: Range[] = ['4W', '8W', '3M', '6M', 'All']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function ExerciseProgressChart({ points, accentColor, cardBg }: Props) {
  // Fix 1: default to 'All' when entire dataset spans fewer than 28 days
  const [range, setRange] = useState<Range>(() => {
    if (points.length < 2) return 'All'
    const spanDays =
      (points[points.length - 1].date.getTime() - points[0].date.getTime()) / 86400000
    return spanDays < 28 ? 'All' : '3M'
  })

  const now = new Date()
  const diffDays = (d: Date) => (now.getTime() - d.getTime()) / 86400000

  let pts = points.filter(p => diffDays(p.date) <= CUTOFF_DAYS[range])
  if (pts.length < 2) pts = [...points]

  const n = pts.length

  if (n === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: '#888888', fontSize: 12 }}>
        No data yet
      </div>
    )
  }

  // Y bounds
  const values = pts.map(p => p.est1RM)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  let yMin: number, yMax: number
  if (rawMax === rawMin) {
    // Flat line — give 3% breathing room so it sits centred in the drawable area
    yMin = rawMin * 0.97
    yMax = rawMax * 1.03
  } else {
    const spread = rawMax - rawMin
    yMin = Math.floor((rawMin - spread * 0.1) / 5) * 5
    yMax = Math.ceil((rawMax + spread * 0.1) / 5) * 5
  }
  const yRange = yMax - yMin

  // Drawable area is y 12–152; center = 82
  const xScale = (i: number) => (n === 1 ? 28 + 161 : 28 + (i / (n - 1)) * 322)
  const yScale = (v: number) => 152 - ((v - yMin) / yRange) * 140

  // Grid lines (4)
  const gridVals = Array.from({ length: 4 }, (_, i) => yMin + (yRange / 3) * i)

  // Fix 8: when all visible points share the same calendar month, show
  // "Apr 6" style labels; otherwise show month abbreviations only.
  const allSameMonth =
    pts.length > 0 &&
    pts.every(
      p =>
        p.date.getMonth() === pts[0].date.getMonth() &&
        p.date.getFullYear() === pts[0].date.getFullYear()
    )

  const xLabelCount = Math.min(5, n)
  const xLabels =
    xLabelCount <= 1
      ? [
          {
            x: xScale(0),
            label: allSameMonth
              ? `${MONTHS[pts[0].date.getMonth()]} ${pts[0].date.getDate()}`
              : MONTHS[pts[0].date.getMonth()],
          },
        ]
      : Array.from({ length: xLabelCount }, (_, i) => {
          const idx = Math.round((i / (xLabelCount - 1)) * (n - 1))
          const p = pts[idx]
          return {
            x: xScale(idx),
            label: allSameMonth
              ? `${MONTHS[p.date.getMonth()]} ${p.date.getDate()}`
              : MONTHS[p.date.getMonth()],
          }
        })

  // Cubic bezier path
  let linePath = `M ${xScale(0).toFixed(1)},${yScale(pts[0].est1RM).toFixed(1)}`
  let areaPath = `M ${xScale(0).toFixed(1)},${yScale(pts[0].est1RM).toFixed(1)}`
  for (let i = 1; i < n; i++) {
    const x0 = xScale(i - 1)
    const y0 = yScale(pts[i - 1].est1RM)
    const x1 = xScale(i)
    const y1 = yScale(pts[i].est1RM)
    const dx = (x1 - x0) / 3
    linePath += ` C ${(x0 + dx).toFixed(1)},${y0.toFixed(1)} ${(x1 - dx).toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`
    areaPath += ` C ${(x0 + dx).toFixed(1)},${y0.toFixed(1)} ${(x1 - dx).toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`
  }
  areaPath += ` L ${xScale(n - 1).toFixed(1)},152 L ${xScale(0).toFixed(1)},152 Z`

  // Special points
  const prIdx = pts.findIndex(p => p.isPR)
  const lastIdx = n - 1
  const lastPt = pts[lastIdx]
  const lastX = xScale(lastIdx)
  const lastY = yScale(lastPt.est1RM)

  const chartCSS = `
    @keyframes ch-draw   { from { stroke-dashoffset: 1200 } to { stroke-dashoffset: 0 } }
    @keyframes ch-fadein { from { opacity: 0 } to { opacity: 1 } }
    @keyframes ch-breathe { 0%,100% { opacity: 0.3 } 50% { opacity: 0 } }
    .ch-line { stroke-dasharray: 1200; stroke-dashoffset: 1200; animation: ch-draw 1.8s ease forwards }
    .ch-area { opacity: 0; animation: ch-fadein 1.8s ease 0.2s forwards }
    .ch-dot  { opacity: 0; animation: ch-fadein 0.4s ease 1.8s forwards }
    .ch-pr-ring { animation: ch-breathe 2s ease-in-out 2.2s infinite }
  `

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: chartCSS }} />

      <svg
        width="100%"
        viewBox="0 0 358 175"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="ch-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1="28" y1={yScale(v)} x2="350" y2={yScale(v)} stroke="#1c1c1c" strokeWidth="1" />
            <text
              x="23"
              y={yScale(v) + 4}
              textAnchor="end"
              fill="#b8b8b8"
              fontSize="11"
              fontFamily="monospace"
            >
              {v.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#ch-grad)" className="ch-area" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ch-line"
        />

        {/* PR dot + breathing ring */}
        {prIdx >= 0 && prIdx !== lastIdx && (
          <g className="ch-dot">
            <circle
              cx={xScale(prIdx)}
              cy={yScale(pts[prIdx].est1RM)}
              r="12"
              fill="none"
              stroke={accentColor}
              strokeWidth="1"
              className="ch-pr-ring"
            />
            <circle cx={xScale(prIdx)} cy={yScale(pts[prIdx].est1RM)} r="5" fill={accentColor} />
          </g>
        )}

        {/* Latest point tooltip + dot */}
        <g className="ch-dot">
          <rect
            x={Math.min(lastX - 26, 298)}
            y={lastY - 27}
            width={52}
            height={18}
            rx="5"
            fill="#1a1a1a"
            stroke={accentColor}
            strokeWidth="0.5"
            strokeOpacity="0.4"
          />
          <text
            x={Math.min(lastX, 324)}
            y={lastY - 14}
            textAnchor="middle"
            fill={accentColor}
            fontSize="9"
            fontWeight="700"
            fontFamily="monospace"
          >
            {lastPt.est1RM.toFixed(1)} kg
          </text>
          <circle cx={lastX} cy={lastY} r="5.5" fill={accentColor} />
          <circle cx={lastX} cy={lastY} r="2.5" fill={cardBg} />
        </g>

        {/* X-axis labels */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y="170"
            textAnchor="middle"
            fill="#888888"
            fontSize="11"
            fontFamily="monospace"
          >
            {l.label}
          </text>
        ))}
      </svg>

      {/* Range tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 0 2px', justifyContent: 'flex-end' }}>
        {RANGES.map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 8,
              border: r === range ? `1px solid ${accentColor}` : '1px solid #222',
              background: r === range ? 'rgba(62,207,142,0.08)' : 'transparent',
              color: r === range ? accentColor : '#888888',
              cursor: 'pointer',
              letterSpacing: '0.5px',
              fontFamily: 'monospace',
            }}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}
