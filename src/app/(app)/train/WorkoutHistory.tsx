'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateString, parseLocalDateString } from '@/lib/dateUtils'

type WorkoutSet = {
  workout_id: string
  exercise_name: string
  set_number: number
  weight_kg: number
  reps_completed: number
  set_type: string | null
}

type HistoryWorkout = {
  id: string
  completedAt: string
  durationMinutes: number | null
  routineName: string | null
  sets: WorkoutSet[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_LABELS = ['M','T','W','T','F','S','S']
const WEEKDAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function relativeDate(iso: string): string {
  const workoutDate = parseLocalDateString(getLocalDateString(new Date(iso)))
  const today = parseLocalDateString(getLocalDateString())
  const diff = workoutDate && today
    ? Math.round((today.getTime() - workoutDate.getTime()) / 86400000)
    : Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`
  return `${Math.floor(diff / 30)}mo ago`
}

function formatDateInline(iso: string): string {
  const d = new Date(iso)
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

function deriveWorkoutName(sets: WorkoutSet[]): string {
  if (sets.length === 0) return 'Custom Workout'
  const counts = new Map<string, number>()
  for (const s of sets) counts.set(s.exercise_name, (counts.get(s.exercise_name) ?? 0) + 1)
  let top = ''
  let topCount = 0
  counts.forEach((count, name) => { if (count > topCount) { topCount = count; top = name } })
  return top ? `${top} session` : 'Custom Workout'
}

function getBestSet(sets: WorkoutSet[]): { exercise: string; weight: number; reps: number } | null {
  if (sets.length === 0) return null
  const workingSets = sets.filter(s => s.set_type === 'working')
  const pool = workingSets.length > 0 ? workingSets : sets
  const best = pool.reduce((max, s) => s.weight_kg > max.weight_kg ? s : max)
  if (best.weight_kg === 0) return null
  return { exercise: best.exercise_name, weight: best.weight_kg, reps: best.reps_completed }
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

function WorkoutCalendar({ year, month, workoutDays, onMonthChange }: {
  year: number
  month: number
  workoutDays: Set<string>
  onMonthChange: (dir: 1 | -1) => void
}) {
  const today = new Date()
  const todayStr = getLocalDateString(today)

  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells: { day: number; currentMonth: boolean; dateStr: string }[] = []

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    cells.push({ day: d, currentMonth: false, dateStr: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
  }
  let nextDay = 1
  while (cells.length % 7 !== 0) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    cells.push({ day: nextDay, currentMonth: false, dateStr: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}` })
    nextDay++
  }

  const isFuture = year > today.getFullYear() || (year === today.getFullYear() && month >= today.getMonth())

  return (
    <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '18px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
      {/* Month nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <button
          onClick={() => onMonthChange(-1)}
          style={{ background: 'none', border: 'none', color: '#b8b8b8', fontSize: '18px', cursor: 'pointer', padding: '2px 10px', lineHeight: 1, borderRadius: '6px', fontFamily: 'inherit' }}
        >
          ‹
        </button>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0' }}>
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={() => onMonthChange(1)}
          disabled={isFuture}
          style={{ background: 'none', border: 'none', color: isFuture ? '#888888' : '#b8b8b8', fontSize: '18px', cursor: isFuture ? 'not-allowed' : 'pointer', padding: '2px 10px', lineHeight: 1, borderRadius: '6px', fontFamily: 'inherit' }}
        >
          ›
        </button>
      </div>

      {/* Day-of-week labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {DAY_LABELS.map((label, i) => (
          <div key={i} style={{ fontSize: '13px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', textAlign: 'center', padding: '3px 0 5px', letterSpacing: '0.4px' }}>
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((cell, i) => {
          const hasWorkout = cell.currentMonth && workoutDays.has(cell.dateStr)
          const isToday = cell.dateStr === todayStr

          const numColor = !cell.currentMonth ? '#1e1e1e'
            : isToday ? '#0a0a0a'
            : hasWorkout ? '#3ecf8e'
            : '#888888'

          const numWeight = isToday ? 700 : hasWorkout ? 600 : 400

          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 1px', gap: '3px', borderRadius: '5px', background: isToday ? '#3ecf8e' : 'transparent' }}>
              <span style={{ fontSize: '14px', fontWeight: numWeight, color: numColor, lineHeight: 1 }}>
                {cell.day}
              </span>
              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: hasWorkout ? (isToday ? 'rgba(0,0,0,0.3)' : '#3ecf8e') : 'transparent' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Workout Card ─────────────────────────────────────────────────────────────

function WorkoutCard({ workout }: { workout: HistoryWorkout }) {
  const dateStr = formatDateInline(workout.completedAt)
  const relative = relativeDate(workout.completedAt)
  const isNamed = workout.routineName !== null
  const displayName = workout.routineName ?? deriveWorkoutName(workout.sets)
  const bestSet = getBestSet(workout.sets)
  const totalVolume = Math.round(workout.sets.reduce((s, r) => s + r.weight_kg * r.reps_completed, 0))
  const showDuration = (workout.durationMinutes ?? 0) >= 1

  const stats: { text: string }[] = []
  if (showDuration) stats.push({ text: `${workout.durationMinutes} min` })
  if (totalVolume > 0) stats.push({ text: `↑ ${totalVolume.toLocaleString()} kg` })
  if (workout.sets.length > 0) stats.push({ text: `${workout.sets.length} set${workout.sets.length !== 1 ? 's' : ''}` })

  return (
    <Link
      href={`/train/summary/${workout.id}`}
      style={{ display: 'flex', background: '#141414', border: '1px solid #1e1e1e', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', textDecoration: 'none', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}
    >
      {/* Left accent bar */}
      <div style={{ width: '3px', flexShrink: 0, background: isNamed ? '#3ecf8e' : '#1e1e1e' }} />

      {/* Card body */}
      <div style={{ flex: 1, padding: '13px 14px', minWidth: 0 }}>
        {/* Top row: name + date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.3px' }}>{displayName}</div>
          <div style={{ fontSize: '11px', color: '#b8b8b8', whiteSpace: 'nowrap', paddingTop: '2px', marginLeft: '8px' }}>{dateStr}</div>
        </div>

        {/* Relative date */}
        <div style={{ fontSize: '11px', color: '#b8b8b8', marginBottom: '9px' }}>{relative}</div>

        {/* Stats row */}
        {stats.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {stats.map((stat, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {i > 0 && <span style={{ fontSize: '10px', color: '#888888' }}>·</span>}
                <span style={{ fontSize: '13px', color: '#b8b8b8' }}>{stat.text}</span>
              </span>
            ))}
          </div>
        )}

        {/* Best set pill */}
        {bestSet && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '7px', padding: '6px 10px' }}>
            <span style={{ fontSize: '13px', color: '#b8b8b8' }}>{bestSet.exercise}</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.2px' }}>{bestSet.weight} kg × {bestSet.reps}</span>
          </div>
        )}
      </div>

      {/* Right arrow */}
      <div style={{ display: 'flex', alignItems: 'center', paddingRight: '14px', color: '#b8b8b8', fontSize: '16px', flexShrink: 0 }}>›</div>
    </Link>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkoutHistory({ userId }: { userId: string }) {
  const supabase = createClient()
  const [workouts, setWorkouts] = useState<HistoryWorkout[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  useEffect(() => {
    let cancelled = false

    async function fetchHistory() {
      setLoading(true)
      try {
        const { data: rawWorkouts } = await supabase
          .from('workouts')
          .select('id, completed_at, duration_minutes, routine_id, routines(name)')
          .eq('user_id', userId)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })

        if (cancelled || !rawWorkouts) return

        const workoutIds = rawWorkouts.map(w => w.id)

        let allSets: WorkoutSet[] = []
        if (workoutIds.length > 0) {
          const { data: rawSets } = await supabase
            .from('workout_sets')
            .select('workout_id, exercise_name, set_number, weight_kg, reps_completed, set_type')
            .in('workout_id', workoutIds)
            .limit(5000)
          allSets = rawSets ?? []
        }

        if (cancelled) return

        const setsByWorkout = new Map<string, WorkoutSet[]>()
        for (const s of allSets) {
          if (!setsByWorkout.has(s.workout_id)) setsByWorkout.set(s.workout_id, [])
          setsByWorkout.get(s.workout_id)!.push(s)
        }

        const merged: HistoryWorkout[] = rawWorkouts.map(w => ({
          id: w.id,
          completedAt: w.completed_at as string,
          durationMinutes: w.duration_minutes ?? null,
          routineName: (w.routines as any)?.name ?? null,
          sets: setsByWorkout.get(w.id) ?? [],
        }))

        setWorkouts(merged)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchHistory()
    return () => { cancelled = true }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const workoutDays = useMemo(
    () => new Set(workouts.map(w => getLocalDateString(new Date(w.completedAt)))),
    [workouts]
  )

  const workoutsThisMonth = useMemo(() => workouts.filter(w => {
    const d = new Date(w.completedAt)
    return d.getFullYear() === calendarMonth.year && d.getMonth() === calendarMonth.month
  }).length, [workouts, calendarMonth])

  const handleMonthChange = (dir: 1 | -1) => {
    setCalendarMonth(prev => {
      let m = prev.month + dir
      let y = prev.year
      if (m > 11) { m = 0; y++ }
      if (m < 0)  { m = 11; y-- }
      return { year: y, month: m }
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: '12px', height: '220px' }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: '12px', height: '96px' }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
      <WorkoutCalendar
        year={calendarMonth.year}
        month={calendarMonth.month}
        workoutDays={workoutDays}
        onMonthChange={handleMonthChange}
      />

      {workouts.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', gap: '10px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#141414', border: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b8b8b8" strokeWidth="1.5">
              <path d="M6.5 6.5h11M6.5 17.5h11M4 12h16M2 9.5l2 2.5-2 2.5M22 9.5l-2 2.5 2 2.5" />
            </svg>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#b8b8b8' }}>No workouts yet</div>
          <div style={{ fontSize: '12px', color: '#888888', lineHeight: 1.6 }}>Start your first session from the Program tab.</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#b8b8b8', textTransform: 'uppercase', letterSpacing: '1px', paddingTop: '4px', paddingBottom: '2px' }}>
            {workoutsThisMonth} workout{workoutsThisMonth !== 1 ? 's' : ''} this month
          </div>
          {workouts.map(w => <WorkoutCard key={w.id} workout={w} />)}
        </>
      )}
    </div>
  )
}
