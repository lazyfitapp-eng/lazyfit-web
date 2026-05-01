'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import WeekStrip from '@/components/WeekStrip'
import DashboardDatePicker from '@/components/DashboardDatePicker'
import WeeklyCheckinWrapper from '@/components/WeeklyCheckinWrapper'
import SurveyModal from '@/components/SurveyModal'
import WeighInModal from '@/components/WeighInModal'

// ─── Types ───────────────────────────────────────────────────────────────────
const MEALS = [
  { type: 'breakfast', label: 'Breakfast', time: '8:00' },
  { type: 'lunch',     label: 'Lunch',     time: '13:00' },
  { type: 'dinner',    label: 'Dinner',    time: '19:00' },
  { type: 'snack',     label: 'Snacks',    time: 'Anytime' },
] as const

type MealType = typeof MEALS[number]['type']

interface FoodLog {
  id: string
  food_name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  meal_type: string
  quantity: number | null
}

interface Props {
  userId: string
  today: string
  initialLogs: FoodLog[]
  activityByDate: Record<string, { food: boolean; workout: boolean }>
  latestWeight: number | null
  trendWeight: number | null
  weeklyDelta: number | null
  daysSinceWorkout: number
  recentWeights: number[]
  targets: { calories: number; protein: number; carbs: number; fat: number; trainingDaysPerWeek: number }
  checkin: {
    currentWeight: number | null
    prevWeight: number | null
    avgCalories: number
    avgProtein: number
    workoutsThisWeek: number
  }
  chartWeightEntries: { date: string; weight: number; trend_weight: number }[]
  chartFoodLogs: { date: string; calories: number }[]
}

// ─── SummaryCard ─────────────────────────────────────────────────────────────

function SummaryCard({ logs, targets }: { logs: FoodLog[]; targets: Props['targets'] }) {
  const total = logs.reduce(
    (acc, l) => ({ cal: acc.cal + (l.calories ?? 0), p: acc.p + (l.protein ?? 0), c: acc.c + (l.carbs ?? 0), f: acc.f + (l.fat ?? 0) }),
    { cal: 0, p: 0, c: 0, f: 0 }
  )
  const remaining = Math.max(0, targets.calories - Math.round(total.cal))
  const pct = (value: number, target: number) =>
    target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  const calPct = pct(total.cal, targets.calories)

  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl px-4 py-[14px] font-sans" style={{ width: '100%' }}>
      {/* Calorie headline */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="leading-none tracking-[-1px]">
            <span className="text-[32px] font-bold text-[#f0f0f0]" style={{ fontStyle: 'normal', fontVariantNumeric: 'normal', fontFeatureSettings: 'normal' }}>{Math.round(total.cal).toLocaleString()}</span>
            <span className="text-sm font-normal text-[#b8b8b8] ml-[2px]">kcal</span>
          </div>
          <div className="text-[11px] text-[#b8b8b8] mt-[3px]">
            Target: {targets.calories.toLocaleString()} kcal — {remaining.toLocaleString()} remaining
          </div>
        </div>
        <div className="text-right">
          <div className="text-[13px] font-semibold text-[#3ecf8e]">{calPct}%</div>
          <div className="text-[10px] text-[#b8b8b8] mt-[1px]">of target</div>
        </div>
      </div>

      {/* Macro progress bars */}
      {(() => {
        const protein = Math.round(total.p)
        const carbs   = Math.round(total.c)
        const fat     = Math.round(total.f)
        const targetProtein = targets.protein
        const targetCarbs   = targets.carbs
        const targetFat     = targets.fat
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
            {[
              { label: 'Protein', value: protein, target: targetProtein, color: '#3ecf8e' },
              { label: 'Carbs',   value: carbs,   target: targetCarbs,   color: '#2a6e50' },
              { label: 'Fat',     value: fat,     target: targetFat,     color: '#1a3d2c' },
            ].map(({ label, value, target, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '44px', flexShrink: 0, fontSize: '10px', color: '#999999' }}>{label}</span>
                <div style={{ flex: 1, backgroundColor: '#1e1e1e', borderRadius: '3px', height: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct(value, target)}%`, height: '100%', backgroundColor: color, borderRadius: '3px' }} />
                </div>
                <span style={{ width: '42px', flexShrink: 0, fontSize: '10px', color: '#999999', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value} / {target}g</span>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

// ─── WeighInCard ─────────────────────────────────────────────────────────────

function WeighInCard({ weight, trend, weeklyDelta, isToday, onLogWeight }: {
  weight: number | null
  trend: number | null
  weeklyDelta: number | null
  isToday: boolean
  onLogWeight: () => void
}) {
  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl font-sans" style={{ padding: '14px 16px' }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] text-[#555]" style={{ marginBottom: '4px' }}>Weight</div>
          <div className="flex items-baseline gap-[2px]" style={{ lineHeight: 1 }}>
            <span className="text-[34px] font-bold text-[#f0f0f0] tracking-[-1px]">
              {weight ?? '—'}
            </span>
            {weight && <span className="text-[15px] font-normal text-[#b8b8b8]">kg</span>}
          </div>
          {weight && trend && (
            <div className="text-[11px] text-[#b8b8b8]" style={{ marginTop: '4px' }}>Trend {trend} kg</div>
          )}
          {!weight && (
            <div className="text-[11px] text-[#888888] mt-1">
              {isToday ? 'No entry yet today' : 'No entry this day'}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-[6px]">
          {isToday && (
            <button
              onClick={onLogWeight}
              className="text-[11px] font-semibold text-[#3ecf8e] bg-[#0d2118] px-[10px] py-[5px] rounded-[6px]"
            >
              {weight ? 'Update' : 'Log weight'}
            </button>
          )}
          {weeklyDelta !== null && (
            <span
              style={{
                backgroundColor: '#1a1a1a',
                color: '#999999',
                borderRadius: '9999px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 500,
                display: 'inline-block',
              }}
            >
              {weeklyDelta > 0 ? '+' : ''}{weeklyDelta.toFixed(1)} kg this week
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MealCard ────────────────────────────────────────────────────────────────

function MealCard({ meal, logs }: {
  meal: typeof MEALS[number]
  logs: FoodLog[]
}) {
  const router = useRouter()
  const total = logs.reduce(
    (acc, l) => ({ cal: acc.cal + (l.calories ?? 0), p: acc.p + (l.protein ?? 0), c: acc.c + (l.carbs ?? 0), f: acc.f + (l.fat ?? 0) }),
    { cal: 0, p: 0, c: 0, f: 0 }
  )

  // Empty state — compact single row, ~44px tall
  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-between bg-[#141414] border border-[#1e1e1e] rounded-xl font-sans"
           style={{ padding: '13px 16px' }}>
        <div>
          <div className="text-[15px] font-semibold text-[#f0f0f0] leading-none">{meal.label}</div>
          <div className="text-[10px] text-[#b8b8b8]" style={{ marginTop: '1px' }}>{meal.time}</div>
        </div>
        <span
          onClick={() => router.push(`/food?meal=${meal.type}`)}
          style={{
            backgroundColor: '#133d25',
            color: '#3ecf8e',
            borderRadius: '7px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'inline-block',
          }}
        >
          + Add food
        </span>
      </div>
    )
  }

  // Has food — header + macro columns row
  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden font-sans">
      {/* Header row */}
      <div className="flex items-start justify-between px-4 pt-3 pb-3">
        <div>
          <div className="text-[15px] font-semibold text-[#f0f0f0] leading-none">{meal.label}</div>
          <div className="text-[10px] text-[#b8b8b8]" style={{ marginTop: '1px' }}>{meal.time}</div>
        </div>
        <Link href={`/food?meal=${meal.type}`} className="text-xs font-semibold text-[#3ecf8e]">
          + Add
        </Link>
      </div>
      {/* Macro columns — border-top 1px solid #1a1a1a */}
      <div className="flex" style={{ borderTop: '1px solid #1a1a1a' }}>
        {[
          { label: 'kcal',    val: Math.round(total.cal), color: '#f0f0f0' },
          { label: 'protein', val: Math.round(total.p),   color: '#3ecf8e' },
          { label: 'carbs',   val: Math.round(total.c),   color: '#f0f0f0' },
          { label: 'fat',     val: Math.round(total.f),   color: '#f0f0f0' },
        ].map(({ label, val, color }, i, arr) => (
          <div
            key={label}
            className="flex-1 py-2"
            style={{ paddingLeft: '10px', borderRight: i < arr.length - 1 ? '1px solid #1a1a1a' : 'none' }}
          >
            <div className="text-[14px] font-bold leading-none" style={{ color }}>{val}{label !== 'kcal' ? 'g' : ''}</div>
            <div className="text-[9px] text-[#b8b8b8] uppercase" style={{ letterSpacing: '0.3px', marginTop: '2px' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MiniLineChart ────────────────────────────────────────────────────────────

function MiniLineChart({
  points,
  color,
  targetValue,
}: {
  points: { date: string; value: number }[]
  color: string
  targetValue?: number
}) {
  if (points.length < 2) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[10px] text-[#888888] tracking-widest font-sans">NO DATA</p>
      </div>
    )
  }

  const W = 500
  const H = 300
  const PAD = { top: 12, right: 8, bottom: 8, left: 8 }
  const cW = W - PAD.left - PAD.right
  const cH = H - PAD.top - PAD.bottom

  const allValues = points.map(p => p.value)
  if (targetValue !== undefined) allValues.push(targetValue)
  const rawMin = Math.min(...allValues)
  const rawMax = Math.max(...allValues)
  const spread = rawMax - rawMin || 1
  const yMin = rawMin - spread * 0.1
  const yMax = rawMax + spread * 0.1
  const yRange = yMax - yMin

  const sortedDates = [...new Set(points.map(p => p.date))].sort()

  const xScale = (date: string) => {
    if (sortedDates.length <= 1) return PAD.left + cW / 2
    const idx = sortedDates.indexOf(date)
    return PAD.left + (idx / (sortedDates.length - 1)) * cW
  }
  const yScale = (v: number) => PAD.top + cH - ((v - yMin) / yRange) * cH

  const pts = points.map(p => `${xScale(p.date)},${yScale(p.value)}`).join(' ')
  const lastPt = points[points.length - 1]

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
      {[0.25, 0.5, 0.75].map((t, i) => {
        const y = PAD.top + cH * t
        return <line key={i} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1a1a1a" strokeWidth="1" />
      })}
      {targetValue !== undefined && (
        <line
          x1={PAD.left} y1={yScale(targetValue)}
          x2={W - PAD.right} y2={yScale(targetValue)}
          stroke="#b8b8b8" strokeWidth="1.5" strokeDasharray="5 4"
        />
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" opacity="0.9" />
      <circle cx={xScale(lastPt.date)} cy={yScale(lastPt.value)} r="5" fill={color} />
    </svg>
  )
}

// ─── ProgressTabContent ───────────────────────────────────────────────────────

function ProgressTabContent({
  chartWeightEntries,
  chartFoodLogs,
  targetCalories,
}: {
  chartWeightEntries: { date: string; weight: number; trend_weight: number }[]
  chartFoodLogs: { date: string; calories: number }[]
  targetCalories: number
}) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const recentWeights = chartWeightEntries
    .filter(e => e.date >= thirtyDaysAgo)
    .map(e => ({ date: e.date, value: e.weight }))
  const recentFood = chartFoodLogs
    .filter(d => d.date >= thirtyDaysAgo)
    .map(d => ({ date: d.date, value: d.calories }))

  return (
    <div
      className="px-4 pt-3 pb-24"
      style={{ height: 'calc(100dvh - 320px)' }}
    >
      <div className="grid grid-cols-2 gap-3 h-full">
        <Link
          href="/progress#body"
          className="bg-[#141414] border border-[#1e1e1e] hover:border-[#888888] active:opacity-70 rounded-xl p-3 flex flex-col transition-all font-sans"
        >
          <p className="text-[11px] font-semibold text-[#f0f0f0] mb-1 flex-shrink-0">Body Composition</p>
          <div className="flex items-center gap-2 mb-2 flex-shrink-0">
            <div className="w-3 h-[2px] bg-[#3ecf8e] opacity-90 rounded" />
            <span className="text-[9px] text-[#b8b8b8]">Weight</span>
          </div>
          <div className="flex-1 min-h-0">
            <MiniLineChart points={recentWeights} color="#3ecf8e" />
          </div>
        </Link>
        <Link
          href="/progress#nutrition"
          className="bg-[#141414] border border-[#1e1e1e] hover:border-[#888888] active:opacity-70 rounded-xl p-3 flex flex-col transition-all font-sans"
        >
          <p className="text-[11px] font-semibold text-[#f0f0f0] mb-1 flex-shrink-0">Nutrition</p>
          <div className="flex items-center gap-2 mb-2 flex-shrink-0">
            <div className="w-3 h-[2px] bg-[#4a9eff] opacity-90 rounded" />
            <span className="text-[9px] text-[#b8b8b8]">Logged</span>
            <div className="w-3 h-[2px] rounded ml-1" style={{ background: 'repeating-linear-gradient(90deg,#b8b8b8 0 3px,transparent 3px 6px)' }} />
            <span className="text-[9px] text-[#b8b8b8]">Target</span>
          </div>
          <div className="flex-1 min-h-0">
            <MiniLineChart points={recentFood} color="#4a9eff" targetValue={targetCalories} />
          </div>
        </Link>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient({
  userId, today, initialLogs, activityByDate,
  latestWeight, trendWeight, weeklyDelta, daysSinceWorkout,
  recentWeights, targets, checkin, chartWeightEntries, chartFoodLogs,
}: Props) {
  const supabase = createClient()
  const [selectedDate, setSelectedDate] = useState(today)
  const [logs, setLogs] = useState<FoodLog[]>(initialLogs)
  const [isPending, startTransition] = useTransition()
  const [showWeighIn, setShowWeighIn] = useState(false)
  const [displayWeight, setDisplayWeight] = useState(latestWeight)
  const [displayTrend, setDisplayTrend] = useState(trendWeight)
  const [activeTab, setActiveTab] = useState<'daily-log' | 'progress'>('daily-log')

  const fetchLogsForDate = (date: string) => {
    startTransition(async () => {
      const { data } = await supabase
        .from('food_logs')
        .select('id, food_name, calories, protein, carbs, fat, meal_type, quantity')
        .eq('user_id', userId)
        .gte('logged_at', `${date}T00:00:00`)
        .lte('logged_at', `${date}T23:59:59`)
      setLogs((data as FoodLog[]) ?? [])
    })
  }

  const fetchWeightForDate = async (date: string) => {
    const { data } = await supabase
      .from('weight_entries')
      .select('weight, trend_weight')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()
    setDisplayWeight(data?.weight ?? null)
    setDisplayTrend(data?.trend_weight ?? null)
  }

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    if (date !== today) {
      fetchLogsForDate(date)
      fetchWeightForDate(date)
    } else {
      setLogs(initialLogs)
      setDisplayWeight(latestWeight)
      setDisplayTrend(trendWeight)
    }
  }

  const selectedDateObj = new Date(selectedDate + 'T12:00:00')
  const dateHeader = selectedDateObj.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  const logsByMeal = MEALS.reduce((acc, m) => {
    acc[m.type as MealType] = logs.filter(l => l.meal_type === m.type)
    return acc
  }, {} as Record<MealType, FoodLog[]>)

  return (
    <>
      {/* ── Sticky header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a] font-sans">
        <div className="px-5 pt-[18px] pb-0">

          {/* Date + settings */}
          <div className="flex items-center justify-between mb-3">
            <DashboardDatePicker
              dateStr={selectedDate}
              label={dateHeader}
              onDateChange={handleDateChange}
            />
            <Link href="/profile" className="text-[#b8b8b8] hover:text-[#f0f0f0] transition-colors p-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>

          {/* Week strip */}
          <div className="pb-3">
            <WeekStrip
              today={today}
              selected={selectedDate}
              activityByDate={activityByDate}
              onDateClick={handleDateChange}
            />
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-[#1a1a1a]">
            <button
              onClick={() => setActiveTab('daily-log')}
              className={`pb-[9px] mr-6 text-sm font-medium border-b-2 -mb-px transition-colors font-sans ${
                activeTab === 'daily-log'
                  ? 'text-[#f0f0f0] border-[#3ecf8e]'
                  : 'text-[#888888] border-transparent hover:text-[#888]'
              }`}
            >
              Daily log
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={`pb-[9px] mr-6 text-sm font-medium border-b-2 -mb-px transition-colors font-sans ${
                activeTab === 'progress'
                  ? 'text-[#f0f0f0] border-[#3ecf8e]'
                  : 'text-[#888888] border-transparent hover:text-[#888]'
              }`}
            >
              Progress
            </button>
          </div>
        </div>
      </div>

      {/* ── Daily log tab ───────────────────────────────────────────── */}
      {activeTab === 'daily-log' && (
        <div className={`px-5 pt-[14px] pb-24 flex flex-col gap-2 transition-opacity duration-150 font-sans ${isPending ? 'opacity-50' : 'opacity-100'}`}>
          <WeeklyCheckinWrapper
            userId={userId}
            currentWeight={checkin.currentWeight}
            prevWeight={checkin.prevWeight}
            avgCalories={checkin.avgCalories}
            targetCalories={targets.calories}
            avgProtein={checkin.avgProtein}
            targetProtein={targets.protein}
            targetCarbs={targets.carbs}
            targetFat={targets.fat}
            workoutsThisWeek={checkin.workoutsThisWeek}
            targetDaysPerWeek={targets.trainingDaysPerWeek}
          />

          {/* Section: Today's summary */}
          <div className="text-[10px] font-bold text-[#b8b8b8] uppercase font-sans pt-1 pb-0.5"
               style={{ letterSpacing: '1px' }}>
            Today&apos;s summary
          </div>
          <SummaryCard logs={logs} targets={targets} />

          {/* Section: Body */}
          <div className="text-[10px] font-bold text-[#b8b8b8] uppercase font-sans pt-1 pb-0.5"
               style={{ letterSpacing: '1px' }}>
            Body
          </div>
          <WeighInCard
            weight={displayWeight}
            trend={displayTrend}
            weeklyDelta={weeklyDelta}
            isToday={selectedDate === today}
            onLogWeight={() => setShowWeighIn(true)}
          />

          {/* Section: Nutrition */}
          <div className="text-[10px] font-bold text-[#b8b8b8] uppercase font-sans pt-1 pb-0.5"
               style={{ letterSpacing: '1px' }}>
            Nutrition
          </div>
          {MEALS.map(meal => (
            <MealCard
              key={meal.type}
              meal={meal}
              logs={logsByMeal[meal.type]}
            />
          ))}

          {/* Section: Training */}
          <div className="text-[10px] font-bold text-[#b8b8b8] uppercase font-sans pt-1 pb-0.5"
               style={{ letterSpacing: '1px' }}>
            Training
          </div>
          <Link
            href="/train"
            className="block rounded-xl px-4 py-[14px] font-sans"
            style={{ background: '#0d1f17', border: '1px solid #1a3528' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-[#3ecf8e] uppercase mb-1"
                     style={{ letterSpacing: '1px' }}>
                  Today&apos;s session
                </div>
                <div className="text-[15px] font-bold text-[#f0f0f0]">
                  {daysSinceWorkout === 0 ? 'Session logged today' : 'Start a workout'}
                </div>
                <div className="text-[11px] text-[#3a5040] mt-[2px]">
                  {daysSinceWorkout === 0
                    ? 'Great work today!'
                    : daysSinceWorkout === 1
                    ? 'Last done: yesterday'
                    : daysSinceWorkout < 99
                    ? `Last done: ${daysSinceWorkout} days ago`
                    : 'No sessions yet'}
                </div>
              </div>
              <div className="bg-[#3ecf8e] text-[#0a0a0a] rounded-[8px] px-[18px] py-[10px] text-[13px] font-bold flex-shrink-0">
                Start
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* ── Progress tab ────────────────────────────────────────────── */}
      {activeTab === 'progress' && (
        <ProgressTabContent
          chartWeightEntries={chartWeightEntries}
          chartFoodLogs={chartFoodLogs}
          targetCalories={targets.calories}
        />
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {activeTab === 'daily-log' && daysSinceWorkout >= 3 && (
        <SurveyModal
          surveyKey="workout_friction"
          title="If you've looked at the workout but didn't start yet, what's the main reason?"
          subtitle="If it's something else, a couple of words is fine."
          delayMs={4000}
          options={[
            "Workout felt too long / hard",
            "I just wanted to check the plan",
            "I wasn't sure how to start",
            "Not the kind of workout I wanted",
            "Something in the app didn't work",
            "I haven't had time yet",
          ]}
        />
      )}

      {showWeighIn && (
        <WeighInModal
          userId={userId}
          recentWeights={recentWeights}
          onSave={(weight, trend) => {
            if (selectedDate === today) {
              setDisplayWeight(weight)
              setDisplayTrend(trend)
            }
          }}
          onClose={() => setShowWeighIn(false)}
        />
      )}
    </>
  )
}
