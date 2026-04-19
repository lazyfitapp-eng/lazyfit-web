'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ExerciseSummary, PREntry } from './page'
import type { CoachingCard, CoachingBadge } from '@/lib/coachingRules'

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = '1m' | '3m' | '6m' | 'all'

interface WeightPoint {
  date: string
  weight: number
  trendWeight: number | null
}

interface WaistPoint {
  date: string
  waist_cm: number
}

interface FoodLogDay {
  date: string
  calories: number
  protein: number
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  userName: string
  goal: 'cut' | 'bulk' | 'recomp'
  targetCalories: number
  targetProtein: number
  userCreatedAt: string
  trainingDates: string[]
  totalSessions: number
  weeksActive: number
  currentStreakWeeks: number
  bestStreakWeeks: number
  topExercises: ExerciseSummary[]
  allTimePRs: PREntry[]
  weightHistory: WeightPoint[]
  waistHistory: WaistPoint[]
  weekFoodLogs: FoodLogDay[]
  coachingCard: CoachingCard
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodDays(p: Period): number | null {
  if (p === '1m') return 30
  if (p === '3m') return 90
  if (p === '6m') return 180
  return null
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Local-timezone YYYY-MM-DD (avoids UTC midnight-shift in UTC+ zones) */
function localIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr(): string {
  return dateStr(new Date())
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

function weekMonday(d: Date): Date {
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  const m = new Date(d)
  m.setDate(d.getDate() - dow)
  m.setHours(0, 0, 0, 0)
  return m
}

// Trend badge config
function trendLabel(t: ExerciseSummary['trend']): { text: string; cls: 'r' | 'h' | 'n' | 'b' } {
  if (t === 'rising')    return { text: '↑ Rising', cls: 'r' }
  if (t === 'holding')   return { text: '— Holding', cls: 'h' }
  if (t === 'attention') return { text: '⚠ Needs attention', cls: 'n' }
  return { text: '📈 Building baseline', cls: 'b' }
}

// Badge colors
function badgeStyle(cls: 'r' | 'h' | 'n' | 'b'): React.CSSProperties {
  if (cls === 'r') return { background: 'rgba(62,207,142,0.09)', color: '#3ecf8e', border: '1px solid rgba(62,207,142,0.18)' }
  if (cls === 'h') return { background: 'rgba(100,100,100,0.07)', color: '#555', border: '1px solid #1e1e1e' }
  if (cls === 'n') return { background: 'rgba(245,166,35,0.07)', color: '#f5a623', border: '1px solid rgba(245,166,35,0.18)' }
  return { background: 'rgba(74,158,255,0.07)', color: '#4a9eff', border: '1px solid rgba(74,158,255,0.15)' }
}

function coachBadgeStyle(badge: CoachingBadge): React.CSSProperties {
  if (badge === 'ach') return { background: 'rgba(62,207,142,0.09)', color: '#3ecf8e', border: '1px solid rgba(62,207,142,0.2)' }
  if (badge === 'enc') return { background: 'rgba(74,158,255,0.08)', color: '#4a9eff', border: '1px solid rgba(74,158,255,0.15)' }
  if (badge === 'act') return { background: 'rgba(245,166,35,0.08)', color: '#f5a623', border: '1px solid rgba(245,166,35,0.18)' }
  return { background: 'rgba(182,109,255,0.07)', color: '#b66dff', border: '1px solid rgba(182,109,255,0.18)' }
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── Calendar ─────────────────────────────────────────────────────────────────

function CalendarMonth({
  trainingDates,
  userCreatedAt,
  period,
}: {
  trainingDates: string[]
  userCreatedAt: string
  period: Period
}) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const todayIso = localIso(now)
  const tSet = new Set(trainingDates)

  // Compute start month: earliest of account creation or first workout
  const accountMonth = new Date(userCreatedAt)
  accountMonth.setDate(1)
  accountMonth.setHours(0, 0, 0, 0)

  const firstTrainingMonth = trainingDates.length > 0
    ? (() => { const d = new Date(trainingDates[0]); d.setDate(1); d.setHours(0, 0, 0, 0); return d })()
    : null

  let startMonth = firstTrainingMonth && firstTrainingMonth < accountMonth
    ? firstTrainingMonth
    : accountMonth

  // Period floor: for filtered views, go back at least as far as the period start
  // This ensures a new user on "3M" sees Jan–Apr rather than just Apr
  if (period !== 'all') {
    const monthsBack = period === '1m' ? 1 : period === '3m' ? 3 : 6
    const periodFloor = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
    if (periodFloor < startMonth) {
      startMonth = periodFloor
    }
  }

  // Build list of (year, month) from startMonth → current month, oldest first
  const monthList: { year: number; month: number }[] = []
  const cursor = new Date(startMonth)
  const nowFirst = new Date(now.getFullYear(), now.getMonth(), 1)
  while (cursor <= nowFirst) {
    monthList.push({ year: cursor.getFullYear(), month: cursor.getMonth() })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {monthList.map(({ year, month }, mIdx) => {
        // Monday-anchored first day offset
        const firstDow = (() => {
          const d = new Date(year, month, 1).getDay()
          return d === 0 ? 6 : d - 1
        })()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const cells: React.ReactNode[] = []
        let trainedIdx = 0

        // Empty leading cells
        for (let i = 0; i < firstDow; i++) {
          cells.push(<div key={`e${i}`} style={{ height: 34 }} />)
        }

        for (let day = 1; day <= daysInMonth; day++) {
          const d = new Date(year, month, day)
          const iso = localIso(d)
          const isFuture = d > now
          const isTrained = tSet.has(iso)
          const isToday = iso === todayIso

          let bg = 'transparent'
          let color = '#2e2e2e'
          let fontWeight: number = 600
          let boxShadow = 'none'
          let animDelay = '0s'
          let animName = 'none'

          if (isFuture) {
            color = '#1e1e1e'
          } else if (isTrained) {
            bg = '#3ecf8e'
            color = '#051a10'
            fontWeight = 800
            animName = 'cal-pop'
            animDelay = `${trainedIdx * 0.045}s`
            trainedIdx++
            if (isToday) {
              boxShadow = '0 0 0 2px #3ecf8e, 0 0 12px rgba(62,207,142,0.4)'
            }
          } else {
            color = '#888888'
          }

          if (isToday && !isTrained) {
            color = '#3ecf8e'
            fontWeight = 800
            boxShadow = '0 0 0 2px #3ecf8e'
          }

          cells.push(
            <div
              key={iso}
              style={{
                width: 34, height: 34,
                margin: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                fontSize: 12,
                fontWeight,
                color,
                background: bg,
                boxShadow,
                animation: animName !== 'none' ? `${animName} 0.25s ease-out ${animDelay} both` : undefined,
              }}
            >
              {day}
            </div>
          )
        }

        return (
          <div key={`${year}-${month}`}>
            {/* Month header; add top divider between months */}
            {mIdx > 0 && <div style={{ height: 1, background: '#141414', marginBottom: 16 }} />}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: mIdx === monthList.length - 1 ? '#f0f0f0' : '#b8b8b8', letterSpacing: '-0.3px' }}>{MONTHS_FULL[month]}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#2e2e2e', letterSpacing: '-0.1px' }}>{year}</span>
            </div>
            {/* Day headers — shown on every month so all grids have identical column structure */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: i >= 5 ? '#222' : '#2e2e2e', letterSpacing: '0.5px', textTransform: 'uppercase', paddingBottom: 4 }}>{d}</div>
              ))}
            </div>
            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {cells}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Week Dots ─────────────────────────────────────────────────────────────────

function WeekDots({
  trainingDates,
  currentStreakWeeks,
  bestStreakWeeks,
  totalSessions,
  period,
  weeksActive,
}: {
  trainingDates: string[]
  currentStreakWeeks: number
  bestStreakWeeks: number
  totalSessions: number
  period: Period
  weeksActive: number
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monday = weekMonday(today)
  const tSet = new Set(trainingDates)

  // Build 8 weeks (oldest → newest) for the dot visualization
  const weekData: { count: number; isCurrentWeek: boolean; lbl: string }[] = []
  for (let w = 7; w >= 0; w--) {
    const wkStart = new Date(monday)
    wkStart.setDate(monday.getDate() - w * 7)
    let count = 0
    for (let d = 0; d < 7; d++) {
      const day = new Date(wkStart)
      day.setDate(wkStart.getDate() + d)
      if (day > today) continue
      if (tSet.has(localIso(day))) count++
    }
    const isFirstOfMonth = wkStart.getDate() <= 7
    weekData.push({
      count,
      isCurrentWeek: w === 0,
      lbl: isFirstOfMonth ? MONTHS_SHORT[wkStart.getMonth()] : '',
    })
  }

  // Narrative — uses the full selected period as denominator
  const totalWeeksInRange = period === '1m' ? 4
    : period === '3m' ? 13
    : period === '6m' ? 26
    : Math.max(weeksActive - 1, 1)  // 'all' = actual history minus current week

  // Count completed weeks (≥3 sessions) over the full period range
  let fullWeeks = 0
  for (let w = totalWeeksInRange; w >= 1; w--) {
    const wkStart = new Date(monday)
    wkStart.setDate(monday.getDate() - w * 7)
    let count = 0
    for (let d = 0; d < 7; d++) {
      const day = new Date(wkStart)
      day.setDate(wkStart.getDate() + d)
      if (day > today) continue
      if (tSet.has(localIso(day))) count++
    }
    if (count >= 3) fullWeeks++
  }

  const consistencyPct = fullWeeks / totalWeeksInRange

  let narrative = ''
  if (totalSessions < 8) {
    narrative = `<strong>${totalSessions} sessions</strong> in your first week${totalSessions !== 1 ? 's' : ''}. You've started — that's the hardest part.`
  } else if (consistencyPct >= 0.8) {
    narrative = `<em>${fullWeeks} of ${totalWeeksInRange} weeks</em> you hit 3 sessions. <strong>That's elite consistency.</strong>`
  } else if (consistencyPct >= 0.6) {
    narrative = `<em>${fullWeeks} of ${totalWeeksInRange} weeks</em> at 3 sessions. <strong>Good consistency</strong> — keep the chain going.`
  } else if (consistencyPct >= 0.4) {
    narrative = `<em>${fullWeeks} of ${totalWeeksInRange} weeks</em> complete. <strong>Building the habit</strong> — one more full week makes a real difference.`
  } else {
    narrative = `3 sessions hit in only <em>${fullWeeks} of ${totalWeeksInRange} weeks</em>. <strong>Restart the chain</strong> — one full week this week changes the trend.`
  }

  const isPersonalBest = currentStreakWeeks > 0 && currentStreakWeeks >= bestStreakWeeks

  return (
    <div>
      {/* Narrative */}
      <div
        style={{ fontSize: 13, fontWeight: 500, color: '#555', lineHeight: 1.5, letterSpacing: '-0.2px', marginBottom: 14 }}
        dangerouslySetInnerHTML={{ __html: narrative }}
      />
      {/* Dots row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        {weekData.map((wk, i) => {
          let dotBg = '#141414'
          let dotColor = '#2a2a2a'
          let dotBorder = '1.5px solid #1a1a1a'
          let dotBoxShadow = 'none'

          if (wk.count >= 3) {
            dotBg = '#3ecf8e'
            dotColor = '#051a10'
            dotBorder = 'none'
            dotBoxShadow = '0 0 8px rgba(62,207,142,0.3)'
          } else if (wk.count >= 1) {
            dotBg = 'rgba(62,207,142,0.15)'
            dotColor = 'rgba(62,207,142,0.7)'
            dotBorder = '1.5px solid rgba(62,207,142,0.25)'
          }

          if (wk.isCurrentWeek) {
            dotBoxShadow = dotBoxShadow !== 'none'
              ? dotBoxShadow + ', 0 0 0 2px #3ecf8e'
              : '0 0 0 2px #3ecf8e'
          }

          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800,
                background: dotBg, color: dotColor, border: dotBorder, boxShadow: dotBoxShadow,
              }}>
                {wk.count > 0 ? wk.count : ''}
              </div>
              <div style={{ fontSize: 8, fontWeight: 600, color: '#222', letterSpacing: '0.2px', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                {wk.lbl}
              </div>
            </div>
          )
        })}
      </div>
      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 13, borderTop: '1px solid #141414' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1, color: currentStreakWeeks >= 1 ? '#3ecf8e' : '#b8b8b8' }}>
            {currentStreakWeeks >= 1 ? '🔥 ' : ''}{currentStreakWeeks} {currentStreakWeeks === 1 ? 'wk' : 'wks'}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Current streak
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: isPersonalBest ? 'rgba(62,207,142,0.5)' : '#888888', letterSpacing: '-0.1px' }}>
          {isPersonalBest ? '🏆 Personal best' : `Best ever: ${bestStreakWeeks} wks`}
        </div>
      </div>
    </div>
  )
}

// ── Body Composition SVG Chart ────────────────────────────────────────────────

function BodyCompChart({
  weightHistory,
  waistHistory,
  period,
}: {
  weightHistory: WeightPoint[]
  waistHistory: WaistPoint[]
  period: Period
}) {
  const days = periodDays(period)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cutoff = days ? dateStr(addDays(today, -days)) : '0000-00-00'

  const wPts = weightHistory.filter((p) => p.date >= cutoff)
  const wsPts = waistHistory.filter((p) => p.date >= cutoff)

  if (wPts.length < 2) {
    return (
      <div style={{ padding: '12px 18px', fontSize: 12, color: '#b8b8b8', lineHeight: 1.5 }}>
        Log at least 2 weights to see your chart.
      </div>
    )
  }

  // Chart dimensions
  const W = 358
  const H = 108
  const LEFT = 28
  const RIGHT = W - 6
  const TOP = 8
  const BOTTOM = H - 14

  // Weight scale
  const wVals = wPts.map((p) => p.weight)
  const wMin = Math.min(...wVals)
  const wMax = Math.max(...wVals)
  const wRange = Math.max(wMax - wMin, 2)
  const wPad = wRange * 0.3
  const wScaleMin = wMin - wPad
  const wScaleMax = wMax + wPad

  function wY(v: number) {
    return TOP + ((wScaleMax - v) / (wScaleMax - wScaleMin)) * (BOTTOM - TOP)
  }

  // Waist scale (right axis, different range)
  let wsScaleMin = 70
  let wsScaleMax = 110
  if (wsPts.length >= 2) {
    const wsVals = wsPts.map((p) => p.waist_cm)
    const wsMin = Math.min(...wsVals)
    const wsMax = Math.max(...wsVals)
    const wsRange = Math.max(wsMax - wsMin, 2)
    const wsPad = wsRange * 0.3
    wsScaleMin = wsMin - wsPad
    wsScaleMax = wsMax + wsPad
  }

  function wsY(v: number) {
    return TOP + ((wsScaleMax - v) / (wsScaleMax - wsScaleMin)) * (BOTTOM - TOP)
  }

  // Map date to X
  const allDates = [...wPts.map((p) => p.date), ...wsPts.map((p) => p.date)]
  const minDate = allDates.reduce((a, b) => (a < b ? a : b))
  const maxDate = allDates.reduce((a, b) => (a > b ? a : b))
  const dateRange = Math.max(
    (new Date(maxDate).getTime() - new Date(minDate).getTime()) / 86400000,
    1
  )

  function xOf(iso: string) {
    const days = (new Date(iso).getTime() - new Date(minDate).getTime()) / 86400000
    return LEFT + (days / dateRange) * (RIGHT - LEFT)
  }

  // Build SVG polyline points
  const wPolyline = wPts.map((p) => `${xOf(p.date).toFixed(1)},${wY(p.weight).toFixed(1)}`).join(' ')
  const wsPolyline = wsPts.length >= 2
    ? wsPts.map((p) => `${xOf(p.date).toFixed(1)},${wsY(p.waist_cm).toFixed(1)}`).join(' ')
    : ''

  // Area path for weight
  const wFirst = wPts[0]
  const wLast = wPts[wPts.length - 1]
  const wAreaPath = `M${xOf(wFirst.date).toFixed(1)},${wY(wFirst.weight).toFixed(1)} ${wPts.map((p) => `L${xOf(p.date).toFixed(1)},${wY(p.weight).toFixed(1)}`).join(' ')} L${xOf(wLast.date).toFixed(1)},${BOTTOM} L${xOf(wFirst.date).toFixed(1)},${BOTTOM} Z`

  // X-axis labels
  const xLabels: { x: number; lbl: string }[] = []
  const labelDates = [minDate]
  if (wPts.length > 3) {
    const mid = wPts[Math.floor(wPts.length / 2)].date
    labelDates.push(mid)
  }
  labelDates.push(maxDate)
  const seen = new Set<string>()
  for (const d of labelDates) {
    if (seen.has(d)) continue
    seen.add(d)
    const dt = new Date(d)
    xLabels.push({ x: xOf(d), lbl: `${MONTHS_SHORT[dt.getMonth()]} ${dt.getDate()}` })
  }

  // Y grid lines — include actual min (bottom) and max (top) so user sees real values
  const gridLines = [0, 0.33, 0.67, 1.0].map((frac) => {
    const y = TOP + frac * (BOTTOM - TOP)
    const val = wScaleMax - frac * (wScaleMax - wScaleMin)
    return { y, val: val.toFixed(1) }
  })

  const lastWPt = wPts[wPts.length - 1]
  const lastWsPt = wsPts.length > 0 ? wsPts[wsPts.length - 1] : null

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 12}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="wgProgress" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a9eff" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#4a9eff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {gridLines.map((g) => (
        <line key={g.y} x1={LEFT} y1={g.y} x2={RIGHT} y2={g.y} stroke="#141414" strokeWidth="1" />
      ))}
      {/* Y labels */}
      {gridLines.map((g) => (
        <text key={`lbl${g.y}`} x={LEFT - 4} y={g.y + 3} fontSize="8" fill="#252525" textAnchor="end" fontFamily="monospace">{g.val}</text>
      ))}
      {/* Weight area */}
      <path className="cha" d={wAreaPath} fill="url(#wgProgress)" />
      {/* Weight line */}
      <polyline className="chl" points={wPolyline} fill="none" stroke="#4a9eff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Waist line */}
      {wsPolyline && (
        <polyline className="chl2" points={wsPolyline} fill="none" stroke="#3ecf8e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,3" />
      )}
      {/* End dots */}
      <circle cx={xOf(lastWPt.date)} cy={wY(lastWPt.weight)} r="4.5" fill="#4a9eff" className="cha" />
      {lastWsPt && (
        <circle cx={xOf(lastWsPt.date)} cy={wsY(lastWsPt.waist_cm)} r="4.5" fill="#3ecf8e" className="cha" />
      )}
      {/* X labels */}
      {xLabels.map((l) => (
        <text key={l.lbl} x={l.x} y={H + 8} fontSize="8" fill="#888888" textAnchor="middle" fontFamily="monospace">{l.lbl}</text>
      ))}
    </svg>
  )
}

// ── Hero Statement ────────────────────────────────────────────────────────────

function heroContent(
  userName: string,
  totalSessions: number,
  weeksActive: number,
  currentStreakWeeks: number,
  recentPRCount: number
): { eyebrow: string; statement: React.ReactNode; proof: React.ReactNode } {
  if (totalSessions < 5) {
    const phase = weeksActive <= 1 ? 'Just Started' : 'Early Days'
    return {
      eyebrow: `Week ${weeksActive} · ${phase}`,
      statement: (
        <>
          {totalSessions} sessions.<br />
          <span style={{ color: '#b8b8b8' }}>That&apos;s</span> {totalSessions} more<br />
          than last month.
        </>
      ),
      proof: (
        <>
          Most people never start.{' '}
          <strong style={{ color: '#b8b8b8', fontWeight: 600 }}>You already have.</strong>{' '}
          This screen will look very different in 8 weeks — come back and see.
        </>
      ),
    }
  }

  if (recentPRCount >= 2) {
    return {
      eyebrow: `Week ${weeksActive} · Peak Phase`,
      statement: (
        <>
          {userName}, you&apos;re <em style={{ fontStyle: 'normal', color: '#3ecf8e' }}>stronger</em><br />
          than you&apos;ve <em style={{ fontStyle: 'normal', color: '#3ecf8e' }}>ever</em> been.
        </>
      ),
      proof: (
        <>
          <strong style={{ color: '#b8b8b8', fontWeight: 600 }}>{recentPRCount} PRs this month.</strong>{' '}
          {totalSessions} sessions.{' '}{weeksActive}{' '}weeks without stopping. The data doesn&apos;t lie — and it&apos;s telling a story most people never get to write.
        </>
      ),
    }
  }

  if (currentStreakWeeks >= 4) {
    return {
      eyebrow: `Week ${weeksActive} · Building Momentum`,
      statement: (
        <>
          {currentStreakWeeks} weeks.<br />
          <em style={{ fontStyle: 'normal', color: '#3ecf8e' }}>Zero</em> breaks.
        </>
      ),
      proof: (
        <>
          <strong style={{ color: '#b8b8b8', fontWeight: 600 }}>{totalSessions} sessions logged.</strong>{' '}
          Most people quit in week 3. You&apos;re in the elite {100 - Math.min(95, currentStreakWeeks * 5)}% who keep going.
        </>
      ),
    }
  }

  return {
    eyebrow: `Week ${weeksActive} · In Progress`,
    statement: (
      <>
        {totalSessions} sessions<br />
        and{' '}
        <em style={{ fontStyle: 'normal', color: '#3ecf8e' }}>counting.</em>
      </>
    ),
    proof: (
      <>
        <strong style={{ color: '#b8b8b8', fontWeight: 600 }}>{currentStreakWeeks} week streak.</strong>{' '}
        Every session is data. Every week logged is proof. Keep building the record.
      </>
    ),
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProgressClient({
  userName,
  goal,
  targetCalories,
  targetProtein,
  userCreatedAt,
  trainingDates,
  totalSessions,
  weeksActive,
  currentStreakWeeks,
  bestStreakWeeks,
  topExercises,
  allTimePRs,
  weightHistory,
  waistHistory,
  weekFoodLogs,
  coachingCard,
}: Props) {
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('3m')
  const [showAllPRs, setShowAllPRs] = useState(false)
  const [coachIdx, setCoachIdx] = useState(0)

  // Filter sessions by period for hero stats
  const days = periodDays(period)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cutoff = days ? dateStr(addDays(today, -days)) : '0000-00-00'
  const filteredSessions = trainingDates.filter((d) => d >= cutoff)
  const periodSessions = filteredSessions.length

  // Recent PRs in period
  const recentPRCount = allTimePRs.filter((pr) => pr.date >= cutoff).length

  // Nutrition this week
  const weekCals = weekFoodLogs.length > 0
    ? Math.round(weekFoodLogs.reduce((s, l) => s + l.calories, 0) / weekFoodLogs.length)
    : 0
  const weekProt = weekFoodLogs.length > 0
    ? Math.round(weekFoodLogs.reduce((s, l) => s + l.protein, 0) / weekFoodLogs.length)
    : 0
  const calPct = targetCalories > 0 ? weekCals / targetCalories : 0
  const protPct = targetProtein > 0 ? weekProt / targetProtein : 0

  // Hero content
  const hero = heroContent(userName, periodSessions || totalSessions, weeksActive, currentStreakWeeks, recentPRCount)

  // Top exercise (hero) + secondary (up to 3, must have 4+ sessions to appear)
  const heroExercise = topExercises[0] ?? null
  const secondaryExercises = topExercises.slice(1).filter((ex) => ex.sessionCount >= 4).slice(0, 3)

  // PRs displayed
  const visiblePRs = showAllPRs ? allTimePRs : allTimePRs.slice(0, 5)
  const heroPR = allTimePRs[0] ?? null

  // Weight stats for header
  const filteredWeight = weightHistory.filter((p) => p.date >= cutoff)
  const latestWeight = filteredWeight.length > 0 ? filteredWeight[filteredWeight.length - 1].weight : null
  const firstWeight = filteredWeight.length > 0 ? filteredWeight[0].weight : null
  const weightDelta = latestWeight !== null && firstWeight !== null ? latestWeight - firstWeight : null

  const latestWaist = waistHistory.length > 0 ? waistHistory[waistHistory.length - 1].waist_cm : null
  const firstWaistInPeriod = waistHistory.filter((p) => p.date >= cutoff)
  const firstWaist = firstWaistInPeriod.length > 0 ? firstWaistInPeriod[0].waist_cm : null
  const waistDelta = latestWaist !== null && firstWaist !== null ? latestWaist - firstWaist : null


  // Recomp insight (weight down AND waist down)
  const showRecompInsight =
    goal === 'recomp' &&
    weightDelta !== null && weightDelta < -0.5 &&
    waistDelta !== null && waistDelta < -0.5 &&
    waistHistory.length >= 2

  return (
    <>
      {/* CSS animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cal-pop {
          from { transform: scale(0.6); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes bob {
          0%,100% { transform: translateY(0) rotate(0deg); }
          40%     { transform: translateY(-3px) rotate(-4deg); }
          60%     { transform: translateY(-3px) rotate(4deg); }
        }
        .chl {
          stroke-dasharray: 900; stroke-dashoffset: 900;
          animation: chdraw 1.9s ease 0.5s forwards;
        }
        .chl2 {
          stroke-dasharray: 900; stroke-dashoffset: 900;
          animation: chdraw 1.9s ease 0.7s forwards;
        }
        @keyframes chdraw { to { stroke-dashoffset: 0; } }
        .cha { opacity: 0; animation: chfade 0.5s ease 2.1s forwards; }
        @keyframes chfade { to { opacity: 1; } }
        .rise-1 { opacity: 0; animation: rise 0.6s ease 0.04s both; }
        .rise-2 { opacity: 0; animation: rise 0.6s ease 0.09s both; }
        .rise-3 { opacity: 0; animation: rise 0.6s ease 0.13s both; }
        .rise-4 { opacity: 0; animation: rise 0.6s ease 0.17s both; }
        .rise-5 { opacity: 0; animation: rise 0.6s ease 0.22s both; }
        .rise-6 { opacity: 0; animation: rise 0.6s ease 0.27s both; }
        .rise-7 { opacity: 0; animation: rise 0.6s ease 0.3s both; }
        .rise-8 { opacity: 0; animation: rise 0.6s ease 0.34s both; }
        .rise-9 { opacity: 0; animation: rise 0.6s ease 0.38s both; }
        .rise-10 { opacity: 0; animation: rise 0.6s ease 0.41s both; }
        .rise-11 { opacity: 0; animation: rise 0.6s ease 0.44s both; }
      `}} />

      <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', background: '#090909', minHeight: '100vh', paddingBottom: 80 }}>

        {/* ── NAV ── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'rgba(9,9,9,0.94)',
          backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
          borderBottom: '1px solid #111',
        }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.5px' }}>Progress</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {(['1m','3m','6m','all'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  height: 26, padding: '0 10px', borderRadius: 7,
                  fontSize: 11, fontWeight: 600,
                  color: period === p ? '#e0e0e0' : '#2e2e2e',
                  background: period === p ? '#1c1c1c' : 'transparent',
                  border: period === p ? '1px solid #242424' : 'none',
                  cursor: 'pointer', letterSpacing: '0.2px',
                  fontFamily: 'inherit',
                }}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </nav>

        {/* ── HERO ── */}
        <div style={{ position: 'relative', padding: '36px 20px 28px', overflow: 'hidden' }}>
          {/* BG glow */}
          <div style={{
            position: 'absolute', top: -120, left: -80,
            width: 500, height: 500,
            background: 'radial-gradient(ellipse at 35% 35%, rgba(62,207,142,0.11) 0%, rgba(62,207,142,0.04) 40%, transparent 68%)',
            pointerEvents: 'none',
          }} />
          <div className="rise-1" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#3ecf8e', marginBottom: 16 }}>
            {hero.eyebrow}
          </div>
          <div className="rise-2" style={{ fontSize: 34, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-1.5px', lineHeight: 1.08, marginBottom: 12 }}>
            {hero.statement}
          </div>
          <div className="rise-3" style={{ fontSize: 14, color: '#4a4a4a', lineHeight: 1.55, letterSpacing: '-0.2px', marginBottom: 26 }}>
            {hero.proof}
          </div>
          {/* Stats strip */}
          <div className="rise-4" style={{
            display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
            background: '#0e0e0e', border: '1px solid #1a1a1a',
            borderRadius: 18, overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.8px', lineHeight: 1 }}>{periodSessions}</div>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#2e2e2e' }}>Sessions</div>
            </div>
            <div style={{ background: '#1a1a1a', width: 1 }} />
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: currentStreakWeeks >= 1 ? '#3ecf8e' : '#b8b8b8', letterSpacing: '-0.8px', lineHeight: 1 }}>{currentStreakWeeks >= 1 ? '🔥 ' : ''}{currentStreakWeeks}</div>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#2e2e2e' }}>Wk Streak</div>
              <div style={{ display: 'flex', gap: 6, fontSize: 9, color: '#2e2e2e', fontWeight: 500 }}>
                <span>Best: <span style={{ color: '#b8b8b8' }}>{bestStreakWeeks} wk{bestStreakWeeks !== 1 ? 's' : ''}</span></span>
              </div>
            </div>
            <div style={{ background: '#1a1a1a', width: 1 }} />
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.8px', lineHeight: 1 }}>{weeksActive}</div>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#2e2e2e' }}>Weeks In</div>
            </div>
          </div>
        </div>

        {/* ── TRAINING CONSISTENCY ── */}
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: '#888888', marginBottom: 12, paddingTop: 22 }}>
            Training Consistency
          </div>
          <div className="rise-5" style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 20, padding: '20px 18px 18px' }}>
            <CalendarMonth trainingDates={trainingDates} userCreatedAt={userCreatedAt} period={period} />
            <div style={{ height: 1, background: '#141414', margin: '18px 0 16px' }} />
            <WeekDots
              trainingDates={trainingDates}
              currentStreakWeeks={currentStreakWeeks}
              bestStreakWeeks={bestStreakWeeks}
              totalSessions={totalSessions}
              period={period}
              weeksActive={weeksActive}
            />
          </div>
        </div>

        {/* ── STRENGTH SNAPSHOT ── */}
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: '#888888', marginBottom: 12, paddingTop: 22 }}>
            Strength Snapshot
          </div>

          {heroExercise ? (
            <>
              {/* Hero lift card */}
              {(() => {
                const heroDelta = heroExercise.delta
                const positive = heroDelta > 0
                return (
              <div
                className="rise-6"
                onClick={() => router.push(`/train/exercise/${encodeURIComponent(heroExercise.name)}`)}
                style={{
                  background: positive
                    ? 'linear-gradient(145deg, #0a1f14, #071610 50%, #050f0a)'
                    : 'linear-gradient(145deg, #141414, #0e0e0e 50%, #0a0a0a)',
                  border: positive ? '1px solid rgba(62,207,142,0.18)' : '1px solid #1e1e1e',
                  borderRadius: 20, padding: 20,
                  position: 'relative', overflow: 'hidden',
                  marginBottom: 8, cursor: 'pointer',
                }}
              >
                {/* Top highlight */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: positive ? 'linear-gradient(90deg, transparent, rgba(62,207,142,0.45), transparent)' : 'linear-gradient(90deg, transparent, rgba(120,120,120,0.15), transparent)' }} />
                {/* Glow */}
                {positive && <div style={{ position: 'absolute', top: -40, right: -20, width: 200, height: 200, background: 'radial-gradient(circle, rgba(62,207,142,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  {heroExercise.sessionCount >= 4 ? (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: positive ? 'rgba(62,207,142,0.1)' : 'rgba(100,100,100,0.1)',
                      border: positive ? '1px solid rgba(62,207,142,0.2)' : '1px solid rgba(100,100,100,0.2)',
                      borderRadius: 6, padding: '3px 8px',
                      fontSize: 9, fontWeight: 700,
                      color: positive ? '#3ecf8e' : '#b8b8b8',
                      letterSpacing: '0.5px', textTransform: 'uppercase',
                    }}>
                      {trendLabel(heroExercise.trend).text} · Best lift
                    </div>
                  ) : (
                    <div />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 500, color: positive ? 'rgba(62,207,142,0.35)' : 'rgba(150,150,150,0.35)' }}>
                    tap to explore{' '}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: positive ? 'rgba(62,207,142,0.6)' : 'rgba(180,180,180,0.5)', marginBottom: 6 }}>{heroExercise.name}</div>
                <div style={{ fontSize: 52, fontWeight: 800, color: positive ? '#3ecf8e' : '#c0c0c0', letterSpacing: '-2.5px', lineHeight: 1, marginBottom: 4 }}>
                  {heroExercise.current1RM.toFixed(1)}<span style={{ fontSize: 24, fontWeight: 500, color: positive ? 'rgba(62,207,142,0.5)' : 'rgba(180,180,180,0.4)', letterSpacing: '-1px' }}> kg</span>
                </div>
                <div style={{ fontSize: 13, color: positive ? 'rgba(62,207,142,0.45)' : 'rgba(180,180,180,0.4)', fontWeight: 500, marginBottom: 16 }}>
                  Estimated one-rep max · {heroExercise.sessionCount} session{heroExercise.sessionCount !== 1 ? 's' : ''}
                </div>
                {heroExercise.sessionCount >= 4 ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 14px', borderRadius: 11,
                    background: positive ? 'rgba(9,21,16,0.7)' : '#141414',
                    border: positive ? '1px solid rgba(62,207,142,0.1)' : '1px solid #1e1e1e',
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.6px', color: positive ? '#3ecf8e' : '#b8b8b8' }}>
                      {positive ? '+' : ''}{heroDelta.toFixed(1)} kg
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: positive ? 'rgba(62,207,142,0.5)' : '#555' }}>since your first session</div>
                    <div style={{ fontSize: 11, color: '#2e2e2e', marginLeft: 'auto' }}>
                      {weeksActive > 0 && positive ? `${(heroDelta / weeksActive).toFixed(2)} kg / wk` : ''}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 14px', background: 'rgba(9,21,16,0.7)',
                    border: '1px solid rgba(62,207,142,0.1)', borderRadius: 11,
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(62,207,142,0.45)', marginBottom: 2 }}>Building your baseline</div>
                      <div style={{ fontSize: 12, color: '#3ecf8e', fontWeight: 600 }}>
                        {Math.max(0, 4 - heroExercise.sessionCount)} more session{4 - heroExercise.sessionCount !== 1 ? 's' : ''} → trend unlocks
                      </div>
                    </div>
                  </div>
                )}
              </div>
                )
              })()}

              {/* Secondary grid */}
              {secondaryExercises.length > 0 && (
                <div className="rise-7" style={{ display: 'grid', gridTemplateColumns: secondaryExercises.length === 1 ? '1fr' : '1fr 1fr', gap: 8 }}>
                  {secondaryExercises.map((ex, i) => {
                    const tb = trendLabel(ex.trend)
                    return (
                      <div
                        key={ex.name}
                        onClick={() => router.push(`/train/exercise/${encodeURIComponent(ex.name)}`)}
                        style={{
                          background: '#0e0e0e', border: '1px solid #1a1a1a',
                          borderRadius: 16, padding: 14,
                          cursor: 'pointer', position: 'relative', overflow: 'hidden',
                          gridColumn: secondaryExercises.length === 3 && i === 2 ? 'span 2' : undefined,
                        }}
                      >
                        <svg style={{ position: 'absolute', top: 11, right: 11, color: '#242424' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                        {ex.sessionCount >= 4 && (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            borderRadius: 5, padding: '2px 6px',
                            fontSize: 9, fontWeight: 700, letterSpacing: '0.3px',
                            textTransform: 'uppercase', marginBottom: 9,
                            ...badgeStyle(tb.cls),
                          }}>
                            {tb.text}
                          </div>
                        )}
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 7, lineHeight: 1.3, marginTop: ex.sessionCount < 4 ? 18 : 0 }}>{ex.name}</div>
                        <div style={{ fontSize: 21, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.7px', lineHeight: 1, marginBottom: 3 }}>
                          {ex.current1RM.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 400, color: '#888888' }}> kg</span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: ex.trend === 'rising' ? '#3ecf8e' : ex.trend === 'attention' ? '#f5a623' : '#2e2e2e' }}>
                          {ex.sessionCount >= 4
                            ? ex.trend === 'rising'
                              ? `+${ex.delta.toFixed(1)} kg`
                              : ex.trend === 'attention'
                              ? `${ex.delta.toFixed(1)} kg · declining`
                              : 'Plateau'
                            : `${ex.sessionCount} session${ex.sessionCount !== 1 ? 's' : ''}`}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Unlock prompt if fewer than 3 exercises have 4+ sessions */}
              {(() => {
                const qualified = topExercises.filter((ex) => ex.sessionCount >= 4).length
                const needed = Math.max(0, 3 - qualified)
                return needed > 0 ? (
                  <div style={{ padding: '14px 16px', border: '1px dashed #1a1a1a', borderRadius: 14, marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: '#282828', lineHeight: 1.6 }}>
                      Log {needed} more exercise{needed !== 1 ? 's' : ''} to unlock your full strength snapshot.
                    </div>
                  </div>
                ) : null
              })()}
            </>
          ) : (
            <div style={{ padding: '24px', background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>No strength data yet</div>
              <div style={{ fontSize: 13, color: '#888888' }}>Complete a workout to see your strength snapshot.</div>
            </div>
          )}
        </div>

        {/* ── BODY COMPOSITION ── */}
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: '#888888', marginBottom: 12, paddingTop: 22 }}>
            Body Composition
          </div>
          <div className="rise-8" style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 20, overflow: 'hidden' }}>
            {/* Header stats */}
            <div style={{ padding: '18px 18px 0', display: 'flex', gap: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#888888', marginBottom: 3 }}>Body Weight</div>
                {latestWeight !== null ? (
                  <>
                    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1, color: '#4a9eff' }}>
                      {latestWeight.toFixed(1)}<span style={{ fontSize: 13, fontWeight: 400, color: '#888888' }}> kg</span>
                    </div>
                    {weightDelta !== null && (
                      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 3, color: weightDelta <= 0 ? '#3ecf8e' : '#2e2e2e' }}>
                        {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} kg · {period === 'all' ? 'all time' : period === '1m' ? '4 wks' : period === '3m' ? '12 wks' : '6 mo'}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ marginTop: 2 }}>
                    <button style={{
                      fontSize: 12, fontWeight: 700, color: '#3ecf8e',
                      background: 'rgba(62,207,142,0.08)',
                      border: '1px solid rgba(62,207,142,0.2)',
                      borderRadius: 8, padding: '6px 12px',
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'block', marginBottom: 5,
                    }}>+ Log Weight</button>
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#888888', marginBottom: 3 }}>Waist</div>
                {latestWaist !== null ? (
                  <>
                    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1, color: '#3ecf8e' }}>
                      {latestWaist.toFixed(1)}<span style={{ fontSize: 13, fontWeight: 400, color: '#888888' }}> cm</span>
                    </div>
                    {waistDelta !== null && (
                      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 3, color: waistDelta <= 0 ? '#3ecf8e' : '#2e2e2e' }}>
                        {waistDelta > 0 ? '+' : ''}{waistDelta.toFixed(1)} cm · {period === 'all' ? 'all time' : period === '1m' ? '4 wks' : period === '3m' ? '12 wks' : '6 mo'}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ marginTop: 2 }}>
                    <button style={{
                      fontSize: 12, fontWeight: 700, color: '#3ecf8e',
                      background: 'rgba(62,207,142,0.08)',
                      border: '1px solid rgba(62,207,142,0.2)',
                      borderRadius: 8, padding: '6px 12px',
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'block', marginBottom: 5,
                    }}>+ Log Waist</button>
                    <div style={{ fontSize: 10, color: '#888888', lineHeight: 1.4 }}>
                      Track weekly
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recomp insight */}
            {showRecompInsight && (
              <div style={{
                margin: '10px 18px 0',
                padding: '9px 13px',
                background: 'rgba(62,207,142,0.05)',
                border: '1px solid rgba(62,207,142,0.1)',
                borderRadius: 10,
                fontSize: 12, fontWeight: 500,
                color: 'rgba(62,207,142,0.6)', lineHeight: 1.45, letterSpacing: '-0.1px',
              }}>
                <strong style={{ color: '#3ecf8e', fontWeight: 700 }}>Body recomposition confirmed.</strong>{' '}
                Your waist shrank {Math.abs(waistDelta!).toFixed(1)} cm while weight dropped {Math.abs(weightDelta!).toFixed(1)} kg — you&apos;re losing fat and building muscle simultaneously. This is the goal.
              </div>
            )}

            {/* Chart — full width below stats, matching card padding */}
            <div style={{ padding: '14px 18px 18px', width: '100%', boxSizing: 'border-box' }}>
              <BodyCompChart
                weightHistory={weightHistory}
                waistHistory={waistHistory}
                period={period}
              />
            </div>

            {/* Legend (only if waist data) */}
            {waistHistory.length >= 2 && (
              <div style={{ display: 'flex', gap: 14, padding: '10px 18px 16px', borderTop: '1px solid #111', marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 500, color: '#383838' }}>
                  <div style={{ width: 18, height: 2, borderRadius: 1, background: '#4a9eff' }} />
                  Body Weight
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 500, color: '#383838' }}>
                  <div style={{ width: 18, height: 2, borderRadius: 1, background: 'repeating-linear-gradient(90deg,#3ecf8e 0,#3ecf8e 6px,transparent 6px,transparent 9px)' }} />
                  Waist
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── PR TROPHY CASE ── */}
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: '#888888', marginBottom: 12, paddingTop: 22 }}>
            PR Trophy Case
          </div>
          <div className="rise-9" style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20, animation: 'bob 3.5s ease-in-out infinite' }}>🏆</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.3px' }}>Personal Records</span>
              <span style={{ fontSize: 12, color: '#888888', marginLeft: 'auto' }}>{allTimePRs.length} all time</span>
            </div>

            {heroPR ? (
              <>
                {/* Hero PR */}
                <div
                  onClick={() => router.push(`/train/exercise/${encodeURIComponent(heroPR.exerciseName)}`)}
                  style={{
                    margin: '0 16px 12px',
                    background: 'linear-gradient(145deg, #0a1f14, #071610)',
                    border: '1px solid rgba(62,207,142,0.15)',
                    borderRadius: 16, padding: 16,
                    position: 'relative', overflow: 'hidden', cursor: 'pointer',
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(62,207,142,0.35), transparent)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(62,207,142,0.6)' }}>{heroPR.exerciseName}</div>
                    <div style={{ fontSize: 11, color: 'rgba(62,207,142,0.35)' }}>
                      {new Date(heroPR.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ fontSize: 38, fontWeight: 800, color: '#3ecf8e', letterSpacing: '-1.8px', lineHeight: 1, marginBottom: 4 }}>
                    {heroPR.est1RM.toFixed(1)}<span style={{ fontSize: 18, fontWeight: 400, color: 'rgba(62,207,142,0.45)' }}> kg</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(62,207,142,0.45)' }}>
                    {heroPR.weight} kg × {heroPR.reps} reps · estimated 1RM
                  </div>
                  {heroPR.deltaFromStart > 0 && (
                    <div style={{
                      display: 'inline-block', marginTop: 10,
                      fontSize: 13, fontWeight: 700, color: '#3ecf8e',
                      background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.15)',
                      borderRadius: 8, padding: '5px 11px',
                    }}>
                      +{heroPR.deltaFromStart.toFixed(1)} kg since you started
                    </div>
                  )}
                </div>

                {/* Other PRs as rows */}
                {visiblePRs.slice(1).map((pr) => (
                  <div
                    key={pr.exerciseName + pr.date}
                    onClick={() => router.push(`/train/exercise/${encodeURIComponent(pr.exerciseName)}`)}
                    style={{ padding: '12px 18px 16px', borderTop: '1px solid #111', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#c8c8c8', letterSpacing: '-0.2px', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {pr.exerciseName}
                      </div>
                      <div style={{ fontSize: 11, color: '#888888' }}>
                        {pr.sessionCount >= 4
                          ? `${pr.weight} kg × ${pr.reps} reps · ${new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : `best logged · ${new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8e8', letterSpacing: '-0.5px', lineHeight: 1 }}>
                        {pr.sessionCount >= 4
                          ? <>{pr.est1RM.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 400, color: '#888888' }}> kg</span></>
                          : <>{pr.weight}<span style={{ fontSize: 11, fontWeight: 400, color: '#888888' }}> kg</span></>}
                      </div>
                      {pr.sessionCount >= 4 && pr.deltaFromStart > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#3ecf8e', marginTop: 2 }}>
                          +{pr.deltaFromStart.toFixed(1)} kg
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* See all / collapse */}
                {allTimePRs.length > 5 && (
                  <div
                    onClick={() => setShowAllPRs((v) => !v)}
                    style={{ padding: '13px 18px', borderTop: '1px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#3ecf8e', cursor: 'pointer' }}
                  >
                    {showAllPRs ? 'Show less ↑' : `See all ${allTimePRs.length} PRs →`}
                  </div>
                )}
              </>
            ) : (
              <div style={{ borderTop: '1px solid #111', padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.6px', marginBottom: 8 }}>
                  Your first PR is one session away.
                </div>
                <div style={{ fontSize: 13, color: '#888888', lineHeight: 1.6 }}>
                  Push Set 1 to your absolute limit next workout.<br />
                  <em style={{ fontStyle: 'normal', color: '#b8b8b8' }}>Every record you break lives here forever.</em>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── NUTRITION THIS WEEK ── */}
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: '#888888', marginBottom: 12, paddingTop: 22 }}>
            Nutrition · This Week
          </div>
          <div className="rise-10" style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 20, padding: 18 }}>
            {weekFoodLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 12, color: '#888888' }}>
                No food logged this week. Start logging to see your nutrition snapshot.
              </div>
            ) : (
              <>
                {/* Calories */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#4a4a4a' }}>Avg. daily calories</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#c0c0c0', letterSpacing: '-0.3px' }}>
                      {weekCals.toLocaleString()} / {targetCalories.toLocaleString()} kcal
                    </span>
                  </div>
                  <div style={{ height: 5, background: '#161616', borderRadius: 2.5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2.5, background: 'linear-gradient(90deg, #2d6ab8, #4a9eff)', width: `${Math.min(100, calPct * 100).toFixed(0)}%` }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, marginTop: 5, color: calPct >= 0.9 ? 'rgba(62,207,142,0.65)' : 'rgba(245,166,35,0.65)' }}>
                    {Math.round(calPct * 100)}% of target{calPct >= 0.9 ? ' — excellent, right where you need to be' : ' — eat a little more to fuel your training'}
                  </div>
                </div>
                {/* Protein */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#4a4a4a' }}>Avg. daily protein</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#c0c0c0', letterSpacing: '-0.3px' }}>
                      {weekProt} / {targetProtein} g
                    </span>
                  </div>
                  <div style={{ height: 5, background: '#161616', borderRadius: 2.5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2.5, background: 'linear-gradient(90deg, #2aaa74, #3ecf8e)', width: `${Math.min(100, protPct * 100).toFixed(0)}%` }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, marginTop: 5, color: protPct >= 0.85 ? 'rgba(62,207,142,0.65)' : 'rgba(245,166,35,0.65)' }}>
                    {Math.round(protPct * 100)}% of target{protPct >= 0.85 ? ' — solid foundation, keep building' : ' — increase protein to support muscle growth'}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── YOUR COACH ── */}
        <div style={{ padding: '0 20px 28px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: '#888888', marginBottom: 12, paddingTop: 22 }}>
            Your Coach
          </div>
          <div className="rise-11" style={{
            background: '#0c1c12',
            border: '1px solid rgba(62,207,142,0.11)',
            borderRadius: 20, padding: 22,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(62,207,142,0.4), transparent)' }} />
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              borderRadius: 7, padding: '4px 10px',
              fontSize: 9, fontWeight: 700, letterSpacing: '1px',
              textTransform: 'uppercase', marginBottom: 14,
              ...coachBadgeStyle(coachingCard.badge),
            }}>
              {coachingCard.badgeLabel}
            </div>
            <div style={{ fontSize: 48, lineHeight: 0.5, color: 'rgba(62,207,142,0.09)', fontFamily: 'Georgia, serif', marginBottom: 12, display: 'block' }}>&ldquo;</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.6px', marginBottom: 10, lineHeight: 1.25 }}>
              {coachingCard.headline}
            </div>
            <div
              style={{ fontSize: 14, color: '#b8b8b8', lineHeight: 1.68, letterSpacing: '-0.2px', marginBottom: 18 }}
              dangerouslySetInnerHTML={{ __html: coachingCard.body }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid rgba(62,207,142,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1d3d28, #0c1c12)',
                  border: '1px solid rgba(62,207,142,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                }}>⚡</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(62,207,142,0.45)', letterSpacing: '0.2px' }}>LazyFit Adaptive Coach</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
