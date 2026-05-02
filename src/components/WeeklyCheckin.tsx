'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateDaysAgo, getLocalDateString, getLocalDayBounds } from '@/lib/dateUtils'

const CHECKIN_KEY = 'lf_checkin_week'

interface Props {
  userId: string
  currentWeight: number | null
  prevWeight: number | null
  avgCalories: number
  targetCalories: number
  avgProtein: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
  workoutsThisWeek: number
  targetDaysPerWeek: number
  onClose?: () => void
  onComplete?: () => void
}

interface DayData {
  date: string
  calories: number
  logged: boolean
}

interface ExerciseStats {
  progressed: number
  regressed: number
  held: number
}

function getWeekNumber() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
}

export function WeeklyCheckinBanner({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#1a1200',
        border: '1px solid #3a2a00',
        borderRadius: '12px',
        padding: '12px 16px',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        outline: 'none',
        boxShadow: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,170,0,0.08)', border: '1px solid #3a2a00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFAA00" strokeWidth="2">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 5v5l3 3" />
          </svg>
        </div>
        <div>
          <p style={{ color: '#FFAA00', fontSize: '12px', fontWeight: 600, margin: 0 }}>Weekly Check-in due</p>
          <p style={{ color: '#999999', fontSize: '11px', margin: '2px 0 0' }}>Review your progress and adjust targets</p>
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}

export default function WeeklyCheckin({
  userId,
  currentWeight,
  prevWeight,
  avgCalories,
  targetCalories,
  avgProtein,
  targetProtein,
  targetCarbs,
  targetFat,
  workoutsThisWeek,
  targetDaysPerWeek,
  onClose,
  onComplete,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Step 1 — exercise stats (fetched lazily)
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  // Step 2 — daily food adherence (fetched lazily)
  const [dailyData, setDailyData] = useState<DayData[]>([])
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())
  const [loadingDays, setLoadingDays] = useState(false)
  const [daysError, setDaysError] = useState<string | null>(null)

  // Step 3 — baseline choice
  const [baselineChoice, setBaselineChoice] = useState<'logged' | 'target' | 'custom'>(
    targetCalories > 0 ? 'target' : 'custom'
  )
  const [customCalories, setCustomCalories] = useState('')

  useEffect(() => {
    document.body.classList.add('lazyfit-checkin-open')
    return () => {
      document.body.classList.remove('lazyfit-checkin-open')
    }
  }, [])

  const weightDelta =
    currentWeight && prevWeight
      ? Math.round((currentWeight - prevWeight) * 10) / 10
      : null

  // Average kcal from user-selected days
  const loggedAvg =
    selectedDays.size > 0
      ? Math.round(
          [...selectedDays].reduce((sum, d) => {
            const day = dailyData.find(x => x.date === d)
            return sum + (day?.calories ?? 0)
          }, 0) / selectedDays.size
        )
      : avgCalories

  const baselineCalories =
    baselineChoice === 'logged'
      ? loggedAvg
    : baselineChoice === 'target'
      ? targetCalories
      : parseInt(customCalories) || targetCalories

  // ±100 kcal suggestion based on weight trend
  const suggestion =
    weightDelta !== null
      ? weightDelta > 0.3
        ? -100
        : weightDelta < -0.3
        ? 100
        : 0
      : 0

  const suggestedTarget = Math.max(0, baselineCalories + suggestion)

  const macroTargetsForCalories = (calories: number) => {
    const protein = Math.max(0, Math.round(targetProtein))
    const fat = Math.max(0, Math.round(targetFat))
    const carbsFromCalories = Math.round((calories - protein * 4 - fat * 9) / 4)
    const carbs = Math.max(0, carbsFromCalories)

    return {
      target_calories: calories,
      target_protein: protein,
      target_carbs: Number.isFinite(carbs) ? carbs : targetCarbs,
      target_fat: fat,
    }
  }

  // Fetch exercise stats when entering step 1
  useEffect(() => {
    if (step !== 1 || exerciseStats !== null || loadingStats) return
    setLoadingStats(true)
    ;(async () => {
      setStatsError(null)
      const { data: workouts, error: workoutsError } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(2)

      if (workoutsError) {
        setStatsError(workoutsError.message)
        setExerciseStats({ progressed: 0, regressed: 0, held: 0 })
        setLoadingStats(false)
        return
      }

      if (!workouts || workouts.length < 2) {
        setExerciseStats({ progressed: 0, regressed: 0, held: 0 })
        setLoadingStats(false)
        return
      }

      const [{ data: sets1, error: sets1Error }, { data: sets2, error: sets2Error }] = await Promise.all([
        supabase
          .from('workout_sets')
          .select('exercise_name, weight_kg')
          .eq('workout_id', workouts[0].id),
        supabase
          .from('workout_sets')
          .select('exercise_name, weight_kg')
          .eq('workout_id', workouts[1].id),
      ])

      if (sets1Error || sets2Error) {
        setStatsError(sets1Error?.message ?? sets2Error?.message ?? 'Could not load exercise progress.')
        setExerciseStats({ progressed: 0, regressed: 0, held: 0 })
        setLoadingStats(false)
        return
      }

      const toAvgByExercise = (
        rows: { exercise_name: string; weight_kg: number }[]
      ): Record<string, number> => {
        const acc: Record<string, { sum: number; count: number }> = {}
        for (const r of rows ?? []) {
          if (!acc[r.exercise_name]) acc[r.exercise_name] = { sum: 0, count: 0 }
          acc[r.exercise_name].sum += r.weight_kg
          acc[r.exercise_name].count++
        }
        return Object.fromEntries(
          Object.entries(acc).map(([k, v]) => [k, v.sum / v.count])
        )
      }

      const recent = toAvgByExercise(sets1 ?? [])
      const prior = toAvgByExercise(sets2 ?? [])

      let progressed = 0, regressed = 0, held = 0
      for (const name of Object.keys(recent)) {
        if (!(name in prior)) continue
        const diff = recent[name] - prior[name]
        if (diff > 0.1) progressed++
        else if (diff < -0.1) regressed++
        else held++
      }

      setExerciseStats({ progressed, regressed, held })
      setLoadingStats(false)
    })()
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch daily food data when entering step 2
  useEffect(() => {
    if (step !== 2 || dailyData.length > 0 || loadingDays) return
    setLoadingDays(true)
    ;(async () => {
      const today = getLocalDateString()
      const sevenDaysAgo = getLocalDateDaysAgo(6)
      const todayBounds = getLocalDayBounds(today)
      const sevenDaysAgoBounds = getLocalDayBounds(sevenDaysAgo)

      setDaysError(null)
      const { data: logs, error: logsError } = await supabase
        .from('food_logs')
        .select('logged_at, calories')
        .eq('user_id', userId)
        .gte('logged_at', sevenDaysAgoBounds.start)
        .lte('logged_at', todayBounds.end)

      if (logsError) {
        setDaysError(logsError.message)
        setDailyData([])
        setSelectedDays(new Set())
        setLoadingDays(false)
        return
      }

      const byDate: Record<string, number> = {}
      for (const log of logs ?? []) {
        const date = getLocalDateString(new Date(log.logged_at as string))
        byDate[date] = (byDate[date] ?? 0) + (log.calories ?? 0)
      }

      const days: DayData[] = []
      for (let i = 6; i >= 0; i--) {
        const d = getLocalDateDaysAgo(i)
        const cal = byDate[d] ?? 0
        days.push({ date: d, calories: cal, logged: cal > 0 })
      }

      setDailyData(days)
      setSelectedDays(new Set(days.filter(d => d.logged).map(d => d.date)))
      setLoadingDays(false)
    })()
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => {
    localStorage.setItem(CHECKIN_KEY, String(getWeekNumber()))
    setDone(true)
    onComplete?.()
    if (accepted) router.refresh()
  }

  const acceptSuggestion = async () => {
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase
      .from('profiles')
      .update(macroTargetsForCalories(suggestedTarget))
      .eq('id', userId)
    if (error) {
      setSaveError(error.message)
      setSaving(false)
      return
    }
    setSaving(false)
    setAccepted(true)
    setStep(5)
  }

  const declineSuggestion = () => {
    setAccepted(false)
    setStep(5)
  }

  if (done) return null

  const TOTAL = 6

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-[460px] bg-[#0d0d0d] border border-[#242424] rounded-t-2xl sm:rounded-2xl max-h-[88dvh] sm:max-h-[760px] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex items-center justify-center pt-3 pb-1 flex-shrink-0 relative">
          <div className="w-10 h-1 bg-[#222] rounded-full" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close weekly check-in"
            className="absolute right-4 top-2 w-8 h-8 rounded-full text-[#b8b8b8] hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* Progress pills */}
        {step < 5 && (
          <div className="flex justify-center gap-1.5 py-2 flex-shrink-0">
            {Array.from({ length: TOTAL - 1 }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'bg-primary w-4' : i < step ? 'bg-primary/50 w-1.5' : 'bg-[#222] w-1.5'
                }`}
              />
            ))}
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-5 sm:px-6 pb-[calc(96px+env(safe-area-inset-bottom,0px))]">

          {/* ── Step 0: Weight Review ─────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-6 pt-4">
              <div>
                <p className="text-xs font-semibold tracking-widest text-primary mb-2">STEP 1 OF {TOTAL}</p>
                <h2 className="text-2xl font-bold text-white">Weight Review</h2>
                <p className="text-sm text-[#b8b8b8] mt-2 leading-relaxed">Review your weekly weight trend, then continue.</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-[#2a2a2a] bg-[#151515] p-3 text-center">
                  <p className="text-[11px] font-semibold text-[#b8b8b8] mb-2">Last week</p>
                  <p className="text-3xl font-bold font-mono text-white leading-none">{prevWeight ?? '—'}</p>
                  {prevWeight && <p className="text-sm text-[#b8b8b8] mt-1">kg</p>}
                </div>
                <div className="rounded-xl border border-[#2a2a2a] bg-[#151515] p-3 text-center">
                  <p className="text-[11px] font-semibold text-[#b8b8b8] mb-2">Change</p>
                  <p className={`text-3xl font-bold font-mono leading-none ${
                    weightDelta === null ? 'text-[#888888]'
                    : weightDelta > 0 ? 'text-[#FF0040]'
                    : weightDelta < 0 ? 'text-primary'
                    : 'text-[#555]'
                  }`}>
                    {weightDelta === null ? '—' : `${weightDelta > 0 ? '+' : ''}${weightDelta}`}
                  </p>
                  <p className="text-sm text-[#b8b8b8] mt-1">kg</p>
                </div>
                <div className="rounded-xl border border-[#2a2a2a] bg-[#151515] p-3 text-center">
                  <p className="text-[11px] font-semibold text-[#b8b8b8] mb-2">This week</p>
                  <p className="text-3xl font-bold font-mono text-white leading-none">{currentWeight ?? '—'}</p>
                  {currentWeight && <p className="text-sm text-[#b8b8b8] mt-1">kg</p>}
                </div>
              </div>

              {!currentWeight && (
                <p className="text-sm text-[#b8b8b8] text-center">Log your weight to get full check-in insights.</p>
              )}

              <button
                onClick={() => setStep(1)}
                className="w-full py-4 bg-primary text-black font-bold tracking-widest text-sm rounded-xl hover:bg-[#00CC33] transition-colors"
              >
                CONTINUE
              </button>
            </div>
          )}

          {/* ── Step 1: Exercise Progress ─────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6 pt-4">
              <div>
                <p className="text-xs font-semibold tracking-widest text-primary mb-2">STEP 2 OF {TOTAL}</p>
                <h2 className="text-2xl font-bold text-white">Exercise Progress</h2>
                <p className="text-sm text-[#b8b8b8] mt-2 leading-relaxed">Compared to your previous session.</p>
              </div>

              {loadingStats ? (
                <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-8 text-center">
                  <p className="text-sm text-[#b8b8b8] font-semibold tracking-widest animate-pulse">LOADING...</p>
                </div>
              ) : exerciseStats ? (
                <div className="space-y-3">
                  {statsError && (
                    <p className="text-sm text-[#FFAA00] text-center">
                      Couldn&apos;t load exercise details, so this step is using a safe empty summary.
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-4 text-center">
                      <p className="text-4xl font-bold font-mono text-primary">{exerciseStats.progressed}</p>
                      <p className="text-[11px] font-semibold text-[#b8b8b8] mt-2">Progressed</p>
                    </div>
                    <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-4 text-center">
                      <p className="text-4xl font-bold font-mono text-[#FF0040]">{exerciseStats.regressed}</p>
                      <p className="text-[11px] font-semibold text-[#b8b8b8] mt-2">Regressed</p>
                    </div>
                    <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-4 text-center">
                      <p className="text-4xl font-bold font-mono text-[#b8b8b8]">{exerciseStats.held}</p>
                      <p className="text-[11px] font-semibold text-[#b8b8b8] mt-2">Held</p>
                    </div>
                  </div>
                  <p className="text-sm text-[#b8b8b8] text-center py-1 leading-relaxed">
                    {exerciseStats.progressed + exerciseStats.regressed + exerciseStats.held === 0
                      ? 'Complete at least 2 workouts to see progress comparisons.'
                      : exerciseStats.progressed > exerciseStats.regressed
                      ? 'Solid week — more lifts progressed than regressed.'
                      : exerciseStats.regressed > exerciseStats.progressed
                      ? 'Some regressions this week. Check sleep and recovery.'
                      : 'Weights held steady. Keep building consistency.'}
                  </p>
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 py-4 border border-[#333] text-[#b8b8b8] font-bold tracking-widest text-sm rounded-xl hover:border-[#b8b8b8] transition-colors"
                >
                  BACK
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 bg-primary text-black font-bold tracking-widest text-sm rounded-xl hover:bg-[#00CC33] transition-colors"
                >
                  NEXT
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Nutrition Adherence ───────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6 pt-4">
              <div>
                <p className="text-xs font-semibold tracking-widest text-primary mb-2">STEP 3 OF {TOTAL}</p>
                <h2 className="text-2xl font-bold text-white">Nutrition Adherence</h2>
                <p className="text-sm text-[#b8b8b8] mt-2 leading-relaxed">Deselect any days you know were inaccurate.</p>
              </div>

              {loadingDays ? (
                <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-8 text-center">
                  <p className="text-sm text-[#b8b8b8] font-semibold tracking-widest animate-pulse">LOADING...</p>
                </div>
              ) : daysError ? (
                <p className="text-sm text-[#FFAA00] text-center py-6">
                  Couldn&apos;t load food log details. You can still continue using your current calorie target.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {dailyData.map(day => {
                      const isSelected = selectedDays.has(day.date)
                      return (
                        <button
                          key={day.date}
                          onClick={() => {
                            if (!day.logged) return
                            setSelectedDays(prev => {
                              const next = new Set(prev)
                              if (next.has(day.date)) next.delete(day.date)
                              else next.add(day.date)
                              return next
                            })
                          }}
                          className={`px-3 py-2 rounded-xl text-center transition-all min-w-[70px] ${
                            !day.logged
                              ? 'bg-[#111] border border-[#242424] cursor-default'
                              : isSelected
                              ? 'bg-primary/10 border border-primary'
                              : 'bg-[#151515] border border-[#333]'
                          }`}
                        >
                          <p className={`text-[11px] font-semibold ${
                            !day.logged ? 'text-[#888888]' : isSelected ? 'text-primary' : 'text-[#b8b8b8]'
                          }`}>
                            {formatDay(day.date)}
                          </p>
                          <p className={`text-sm font-mono font-bold mt-0.5 ${
                            !day.logged ? 'text-[#888888]' : isSelected ? 'text-primary' : 'text-[#b8b8b8]'
                          }`}>
                            {day.logged ? `${Math.round(day.calories)}` : '—'}
                          </p>
                          {day.logged && (
                            <p className={`text-[9px] ${isSelected ? 'text-primary/60' : 'text-[#888888]'}`}>
                              kcal
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {selectedDays.size > 0 && (
                    <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-4 flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#b8b8b8]">
                        AVG ({selectedDays.size} {selectedDays.size === 1 ? 'DAY' : 'DAYS'})
                      </p>
                      <p className="text-xl font-bold font-mono text-white">
                        {loggedAvg}{' '}
                        <span className="text-sm font-normal text-[#b8b8b8]">kcal</span>
                      </p>
                    </div>
                  )}

                  {selectedDays.size === 0 && (
                    <p className="text-sm text-[#b8b8b8] text-center py-2">
                      No days selected — we'll use your target calories as the baseline.
                    </p>
                  )}
                </>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 border border-[#333] text-[#b8b8b8] font-bold tracking-widest text-sm rounded-xl hover:border-[#b8b8b8] transition-colors"
                >
                  BACK
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-4 bg-primary text-black font-bold tracking-widest text-sm rounded-xl hover:bg-[#00CC33] transition-colors"
                >
                  NEXT
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Calorie Baseline ──────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6 pt-4">
              <div>
                <p className="text-xs font-semibold tracking-widest text-primary mb-2">STEP 4 OF {TOTAL}</p>
                <h2 className="text-2xl font-bold text-white">Calorie Baseline</h2>
                <p className="text-sm text-[#b8b8b8] mt-2 leading-relaxed">What should we base your adjustment on?</p>
              </div>

              <div className="space-y-2">
                {/* Logged */}
                <button
                  onClick={() => setBaselineChoice('logged')}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border transition-all ${
                    baselineChoice === 'logged'
                      ? 'border-primary bg-primary/5'
                      : 'border-[#2a2a2a] bg-[#151515]'
                  }`}
                >
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${baselineChoice === 'logged' ? 'text-primary' : 'text-white'}`}>
                      Logged
                    </p>
                    <p className="text-sm text-[#b8b8b8] mt-1">
                      From your food log — {loggedAvg} kcal avg
                    </p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    baselineChoice === 'logged' ? 'border-primary bg-primary' : 'border-[#b8b8b8]'
                  }`} />
                </button>

                {/* Target */}
                <button
                  onClick={() => setBaselineChoice('target')}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border transition-all ${
                    baselineChoice === 'target'
                      ? 'border-primary bg-primary/5'
                      : 'border-[#2a2a2a] bg-[#151515]'
                  }`}
                >
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${baselineChoice === 'target' ? 'text-primary' : 'text-white'}`}>
                      Target
                    </p>
                    <p className="text-sm text-[#b8b8b8] mt-1">
                      Your current goal — {targetCalories} kcal
                    </p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    baselineChoice === 'target' ? 'border-primary bg-primary' : 'border-[#b8b8b8]'
                  }`} />
                </button>

                {/* Custom */}
                <div
                  onClick={() => setBaselineChoice('custom')}
                  className={`px-4 py-4 rounded-xl border transition-all cursor-pointer ${
                    baselineChoice === 'custom'
                      ? 'border-primary bg-primary/5'
                      : 'border-[#2a2a2a] bg-[#151515]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-semibold ${baselineChoice === 'custom' ? 'text-primary' : 'text-white'}`}>
                        Custom
                      </p>
                      <p className="text-sm text-[#b8b8b8] mt-1">Enter your actual average manually</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      baselineChoice === 'custom' ? 'border-primary bg-primary' : 'border-[#b8b8b8]'
                    }`} />
                  </div>
                  {baselineChoice === 'custom' && (
                    <div className="mt-4" onClick={e => e.stopPropagation()}>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={customCalories}
                        onChange={e => setCustomCalories(e.target.value)}
                        placeholder="e.g. 2100"
                        autoFocus
                        className="w-full bg-[#0d0d0d] border border-[#888888] rounded-lg px-4 py-3 text-2xl font-mono text-white placeholder:text-[#888888] focus:outline-none focus:border-primary transition-colors text-center"
                      />
                      <p className="text-[10px] text-[#b8b8b8] text-center mt-1.5 tracking-widest">KCAL / DAY</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 border border-[#333] text-[#b8b8b8] font-bold tracking-widest text-sm rounded-xl hover:border-[#b8b8b8] transition-colors"
                >
                  BACK
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={baselineChoice === 'custom' && !customCalories}
                  className="flex-1 py-4 bg-primary text-black font-bold tracking-widest text-sm rounded-xl hover:bg-[#00CC33] transition-colors disabled:opacity-40"
                >
                  NEXT
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Program Update ────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-6 pt-4">
              <div>
                <p className="text-xs font-semibold tracking-widest text-primary mb-2">STEP 5 OF {TOTAL}</p>
                <h2 className="text-2xl font-bold text-white">Program Update</h2>
              </div>

              <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#b8b8b8]">Daily average calories</p>
                    <p className="text-4xl font-bold font-mono text-white mt-2">
                      {suggestedTarget}
                    </p>
                    <p className="text-xs text-[#b8b8b8] mt-0.5">kcal / day</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-[#b8b8b8]">Change</p>
                    <p className={`text-2xl font-bold font-mono mt-2 ${
                      suggestion > 0 ? 'text-primary'
                      : suggestion < 0 ? 'text-[#FF0040]'
                      : 'text-[#555]'
                    }`}>
                      {suggestion === 0 ? '±0' : suggestion > 0 ? `+${suggestion}` : suggestion}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1a1a1a]">
                  <p className="text-sm text-[#b8b8b8] leading-relaxed">
                    {suggestion > 0
                      ? `Your weight dropped ${Math.abs(weightDelta ?? 0).toFixed(1)} kg. Adding ${suggestion} kcal supports your lean mass.`
                      : suggestion < 0
                      ? `Your weight increased ${Math.abs(weightDelta ?? 0).toFixed(1)} kg. Reducing by ${Math.abs(suggestion)} kcal keeps progress on track.`
                      : "Your weight is stable. No calorie adjustment needed — keep doing what you're doing."}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-4 border border-[#333] text-[#b8b8b8] font-bold tracking-widest text-xs rounded-xl hover:border-[#b8b8b8] transition-colors flex-shrink-0"
                >
                  BACK
                </button>
                <button
                  onClick={declineSuggestion}
                  className="flex-1 py-4 border border-[#333] text-[#b8b8b8] font-bold tracking-widest text-sm rounded-xl hover:border-[#b8b8b8] transition-colors"
                >
                  DECLINE
                </button>
                <button
                  onClick={acceptSuggestion}
                  disabled={saving}
                  className="flex-1 py-4 bg-primary text-black font-bold tracking-widest text-sm rounded-xl hover:bg-[#00CC33] transition-colors disabled:opacity-40"
                >
                  {saving ? 'SAVING...' : 'ACCEPT'}
                </button>
              </div>
              {saveError && (
                <p className="text-xs text-[#FF0040] text-center">
                  {saveError}
                </p>
              )}
            </div>
          )}

          {/* ── Step 5: Done ──────────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-5 pt-8 text-center pb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00FF41" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white">
                  {accepted ? 'Program updated.' : 'Check-in complete.'}
                </h2>
                <p className="text-sm text-[#b8b8b8] mt-2">Keep logging to see your trend.</p>
                {accepted && (
                  <p className="text-xs text-[#b8b8b8] mt-3 font-mono">
                    New target:{' '}
                    <span className="text-primary">{suggestedTarget} kcal/day</span>
                  </p>
                )}
              </div>

              <button
                onClick={dismiss}
                className="w-full py-4 bg-primary text-black font-bold tracking-widest text-sm rounded-xl hover:bg-[#00CC33] transition-colors"
              >
                BACK TO DASHBOARD
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
