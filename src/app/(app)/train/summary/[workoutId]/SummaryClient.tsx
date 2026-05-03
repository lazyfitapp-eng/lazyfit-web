'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeMuscleSplit } from '@/lib/muscleMap'
import { isBodyweightExercise } from '@/lib/progressionConfig'

interface WorkoutSet {
  exercise_name: string
  set_number: number
  weight_kg: number
  reps_completed: number
  set_type: string | null
}

interface Props {
  workoutId: string
  routineName: string | null
  routineId: string | null
  completedAt: string
  durationMinutes: number | null
  sets: WorkoutSet[]
  allTimeBest: Record<string, number>
  targets: Record<string, Record<number, { weight: number; repsMin: number; repsMax: number }>>
  userId: string
  prevBestWeight: Record<string, number>
  sessionCount: number
  daysTraining: number
  isPartialSession: boolean
}

// ── Helpers ────────────────────────────────────────────────

function epley1RM(weight: number, reps: number) {
  return weight * (1 + reps / 30)
}

function formatVolume(sets: WorkoutSet[]) {
  const total = sets.reduce((s, r) => s + r.weight_kg * r.reps_completed, 0)
  if (total >= 1000) return (total / 1000).toFixed(1).replace('.0', '') + 'k'
  return Math.round(total).toLocaleString()
}

function formatKg(value: number) {
  return `${Math.round(value).toLocaleString()} kg`
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return count === 1 ? singular : pluralLabel
}

const ESTIMATED_RM_TOLERANCE = 0.5

function bestSetByExercise(sets: WorkoutSet[]): Record<string, { weight: number; reps: number; rm: number }> {
  const best: Record<string, { weight: number; reps: number; rm: number }> = {}
  for (const s of sets) {
    if (s.set_type === 'warmup') continue
    const rm = epley1RM(s.weight_kg, s.reps_completed)
    if (!best[s.exercise_name] || rm > best[s.exercise_name].rm) {
      best[s.exercise_name] = { weight: s.weight_kg, reps: s.reps_completed, rm }
    }
  }
  return best
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatWorkoutDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return 'Today'
  return `${DAY[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m} ${ampm}`
}

// ── Component ──────────────────────────────────────────────

export default function SummaryClient({
  workoutId,
  routineName,
  routineId,
  completedAt,
  durationMinutes,
  sets,
  allTimeBest,
  targets,
  userId,
  prevBestWeight,
  sessionCount,
  daysTraining,
  isPartialSession,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [scrollPct, setScrollPct] = useState(0)
  const [doneReady, setDoneReady] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  const [completionFading, setCompletionFading] = useState(false)
  const [showSaveRoutine, setShowSaveRoutine] = useState(false)
  const [routineNameInput, setRoutineNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedRoutine, setSavedRoutine] = useState(false)
  const [warmupOpen, setWarmupOpen] = useState<Record<string, boolean>>({})
  const [backoffOpen, setBackoffOpen] = useState<Record<string, boolean>>({})

  // Done button glow after 3s
  useEffect(() => {
    const t = setTimeout(() => setDoneReady(true), 3000)
    return () => clearTimeout(t)
  }, [])

  // Scroll progress bar — use React state so the fixed div rerenders reliably
  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0
      setScrollPct(Math.min(pct, 100))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Computed values ──────────────────────────────────────

  const isToday = completedAt ? new Date(completedAt).toDateString() === new Date().toDateString() : false
  const exerciseNames = [...new Set(sets.map(s => s.exercise_name))]
  const muscleSplit = computeMuscleSplit(sets)
  const rawTotalVolume = sets.reduce((sum, s) => sum + s.weight_kg * s.reps_completed, 0)
  const totalVolume = formatVolume(sets)
  const totalVolumeLabel = formatKg(rawTotalVolume)
  const totalSets = sets.filter(s => s.set_type !== 'warmup').length
  const todayBest = bestSetByExercise(sets)

  // PR detection: today's 1RM > all-time best (from before this workout)
  const prs = exerciseNames.filter(name => {
    const best = todayBest[name]
    if (!best) return false
    const prev = allTimeBest[name]
    return prev > 0 && best.rm > prev
  })

  const comparableExercises = exerciseNames.filter(name => prevBestWeight[name] != null && todayBest[name])
  const progressedExercises = comparableExercises.filter(name => {
    const historicalRm = allTimeBest[name]
    if (historicalRm > 0) {
      return todayBest[name].rm > historicalRm + ESTIMATED_RM_TOLERANCE
    }
    return todayBest[name].weight > prevBestWeight[name] + 0.01
  })
  const dippedExercises = comparableExercises.filter(name => {
    const historicalRm = allTimeBest[name]
    if (historicalRm > 0) {
      return todayBest[name].rm < historicalRm - ESTIMATED_RM_TOLERANCE
    }
    return todayBest[name].weight < prevBestWeight[name] - 0.01
  })
  const baselineExercises = exerciseNames.filter(name => todayBest[name] && !allTimeBest[name] && !prevBestWeight[name])
  const isTinySession = totalSets <= 1
  const isLowData = sessionCount < 3 || comparableExercises.length === 0 || isTinySession
  const showMuscleSplit =
    muscleSplit.length > 1 &&
    totalSets >= 3 &&
    !isLowData &&
    !(muscleSplit.length === 1 && muscleSplit[0].muscle === 'Other' && muscleSplit[0].pct >= 95)
  const summaryMode: 'baseline' | 'consistency' | 'progress' | 'regression' =
    !isLowData && (prs.length > 0 || progressedExercises.length > 0) ? 'progress'
    : isLowData ? 'baseline'
    : dippedExercises.length > 0 ? 'regression'
    : 'consistency'
  const highlightExercise = prs[0] ?? progressedExercises[0] ?? dippedExercises[0] ?? exerciseNames[0]
  const highlightLabel = highlightExercise ?? 'This workout'

  const heroCopy = (() => {
    const workoutTitle = `${routineName ?? 'Custom Workout'} ${isPartialSession ? 'Partial Session' : 'Complete'}`
    if (isPartialSession) {
      return { label: 'FINISHED EARLY', title: workoutTitle, subtitle: 'Partial session saved. Targets were not advanced.' }
    }
    if (summaryMode === 'baseline') {
      return {
        label: isTinySession ? 'SESSION SAVED' : 'BASELINE SAVED',
        title: workoutTitle,
        subtitle: isTinySession ? 'One working set logged. More data needed before coaching trends.' : 'More complete sessions will establish a trend.',
      }
    }
    if (summaryMode === 'progress') {
      return {
        label: prs.length > 0 ? 'NEW PERSONAL RECORD' : 'PROGRESS MADE',
        title: workoutTitle,
        subtitle: prs.length > 0 && highlightExercise ? `${highlightExercise} hit a new best.` : 'Progress made.',
      }
    }
    if (summaryMode === 'regression') {
      return { label: 'HOLD THE LINE', title: workoutTitle, subtitle: 'Repeat the target next time.' }
    }
    return { label: 'CONSISTENCY WIN', title: workoutTitle, subtitle: 'You showed up.' }
  })()

  // Per-exercise delta vs previous workout
  function getDelta(name: string): { type: 'up' | 'build' | 'down'; label: string } {
    if (isPartialSession) return { type: 'build', label: 'Partial' }
    if (isLowData) return { type: 'build', label: 'Baseline' }
    const prev = prevBestWeight[name]
    const best = todayBest[name]
    if (!prev || !best) return { type: 'build', label: 'Baseline' }
    const historicalRm = allTimeBest[name]
    if (historicalRm > 0) {
      const rmDiff = best.rm - historicalRm
      if (rmDiff > ESTIMATED_RM_TOLERANCE) return { type: 'up', label: 'New best' }
      if (rmDiff < -ESTIMATED_RM_TOLERANCE) return { type: 'down', label: 'Hold' }
      return { type: 'build', label: 'Same target' }
    }
    const diff = Math.round((best.weight - prev) * 100) / 100
    if (diff > 0.01) return { type: 'up', label: `↑ +${diff}kg` }
    if (diff < -0.01) return { type: 'down', label: `↓ ${Math.abs(diff)}kg` }
    return { type: 'build', label: 'Same target' }
  }

  // Coach badge per exercise (next session target)
  // "Hold" is never used — replaced with "→ Build" (amber)
  function getCoachBadge(name: string): { type: 'up' | 'build'; label: string } {
    if (isPartialSession) return { type: 'build', label: 'No change' }
    const nextTarget = targets[name]?.[1]
    if (!nextTarget) return { type: 'build', label: '→ Build' }
    const workingSets = sets.filter(s => s.exercise_name === name && s.set_type !== 'warmup')
    const allHitMax = workingSets.length > 0 && workingSets.every(s => s.reps_completed >= nextTarget.repsMax)
    const currentWeight = workingSets[0]?.weight_kg ?? nextTarget.weight
    const weightDiff = Math.round((nextTarget.weight - currentWeight) * 100) / 100
    if (allHitMax && weightDiff > 0.01) return { type: 'up', label: `↑ +${weightDiff}kg` }
    return { type: 'build', label: '→ Build' }
  }

  // Coach message — context-aware
  function buildCoachMessage(): string {
    if (prs.length > 0) {
      const names = prs.slice(0, 2).join(' and ')
      return `You showed up and delivered. ${names} ${prs.length === 1 ? 'is' : 'are'} moving — that's what consistent training looks like over weeks. Keep attacking these weights next session.`
    }
    if (sessionCount >= 10) {
      return `${sessionCount} sessions in. Consistency is the whole game — not every session breaks records, but every session builds the base that makes records possible. You're building something real.`
    }
    return `Solid session. Every rep you log is data — the app tracks your progression and will tell you exactly when to push and when to hold. Show up again and the numbers will move.`
  }

  // ── Actions ──────────────────────────────────────────────

  function getTargetAction(name: string): { label: 'Build' | 'Hold' | 'Repeat' | 'Increase'; reason: string; tone: 'green' | 'amber' } {
    if (isPartialSession) {
      return { label: 'Repeat', tone: 'amber', reason: 'Partial session. Finish all planned working sets before targets move.' }
    }
    const nextTarget = targets[name]?.[1]
    const workingSets = sets.filter(s => s.exercise_name === name && s.set_type !== 'warmup')
    const best = todayBest[name]
    const prev = prevBestWeight[name]
    if (!nextTarget || !best || !prev) {
      return { label: 'Repeat', tone: 'amber', reason: 'First comparable session. Lock in clean reps before progressing.' }
    }
    const historicalRm = allTimeBest[name]
    if (historicalRm > 0 && best.rm < historicalRm - ESTIMATED_RM_TOLERANCE) {
      return { label: 'Hold', tone: 'amber', reason: 'Estimated strength dipped. Repeat the target before increasing load.' }
    }
    if (best.weight < prev - 0.01) {
      return { label: 'Hold', tone: 'amber', reason: 'Today dipped. Repeat the target before increasing load.' }
    }
    const allHitMax = workingSets.length > 0 && workingSets.every(s => s.reps_completed >= nextTarget.repsMax)
    const currentWeight = workingSets[0]?.weight_kg ?? nextTarget.weight
    if (allHitMax && nextTarget.weight > currentWeight + 0.01) {
      return { label: 'Increase', tone: 'green', reason: 'You earned the top of the range.' }
    }
    return { label: 'Build', tone: 'amber', reason: "You're inside the target range. Earn the top end before adding load." }
  }

  const coachMessage = (() => {
    if (isPartialSession) {
      return `Finished early.\n\nThis workout was saved as a partial session, so LazyFit did not advance your targets.\n\nNext time: repeat the planned working sets and let a complete session drive progression.`
    }
    if (summaryMode === 'baseline') {
      return `More sessions needed to establish a trend.\n\nThis workout was saved, but LazyFit needs repeated complete sessions before calling progress or regression.\n\nNext time: repeat the planned work and keep the numbers honest.`
    }
    if (summaryMode === 'progress') {
      const name = highlightExercise ?? 'A key lift'
      if (prs.length > 0) {
        return `${name} moved.\n\nYou beat your last comparable session and set a new best set today.\n\nNext time: stay in the target rep range. If you hit the top again, LazyFit will push the load.`
      }
      return `${name} moved.\n\nYou beat your last comparable session today.\n\nNext time: stay in the target rep range and earn the top end before adding load.`
    }
    if (summaryMode === 'regression') {
      return `Hold the line.\n\nToday was below your last comparable session, but one weaker workout is not a trend.\n\nNext time: repeat the same target and win the range before adding load.`
    }
    return `You completed the work.\n\nNot every session needs a PR. Repeating clean reps is how the trend gets built.\n\nNext time: attack the same target and look for one stronger rep.`
  })()

  const statCards = [
    {
      val: totalSets,
      label: isPartialSession ? plural(totalSets, 'set logged', 'sets logged') : plural(totalSets, 'set completed', 'sets completed'),
    },
    {
      val: totalVolumeLabel,
      label: 'total volume',
    },
    isPartialSession
      ? {
          val: 'No change',
          label: 'targets',
        }
      : summaryMode === 'progress'
      ? {
          val: prs.length > 0 ? prs.length : progressedExercises.length,
          label: prs.length > 0 ? plural(prs.length, 'new PR') : plural(progressedExercises.length, 'lift progressed', 'lifts progressed'),
        }
      : summaryMode === 'baseline'
        ? { val: baselineExercises.length || exerciseNames.length, label: plural(baselineExercises.length || exerciseNames.length, 'baseline lift') }
        : summaryMode === 'regression'
          ? { val: dippedExercises.length, label: plural(dippedExercises.length, 'lift dipped', 'lifts dipped') }
          : { val: comparableExercises.length, label: plural(comparableExercises.length, 'same target') },
  ]

  const handleDone = () => {
    setShowCompletion(true)
    setTimeout(() => setCompletionFading(true), 2200)
    setTimeout(() => { isToday ? router.push('/train') : router.back() }, 2900)
  }

  const saveAsRoutine = async () => {
    if (!routineNameInput.trim()) return
    setSaving(true)
    try {
      const { data: routine, error } = await supabase
        .from('routines')
        .insert({ user_id: userId, name: routineNameInput.trim() })
        .select('id')
        .single()

      if (error || !routine) throw new Error(error?.message ?? 'Failed to create custom routine')

      const seen = new Set<string>()
      const routineExercises = []
      let order = 1
      for (const s of sets) {
        if (seen.has(s.exercise_name)) continue
        seen.add(s.exercise_name)
        const exTargets = targets[s.exercise_name]
        const topTarget = exTargets?.[1]
        routineExercises.push({
          routine_id: routine.id,
          exercise_name: s.exercise_name,
          sets_target: sets.filter(x => x.exercise_name === s.exercise_name && x.set_type !== 'warmup').length,
          reps_min: topTarget?.repsMin ?? 8,
          reps_max: topTarget?.repsMax ?? 12,
          rest_seconds: 120,
          exercise_order: order++,
        })
      }

      const { error: exError } = await supabase.from('routine_exercises').insert(routineExercises)
      if (exError) throw new Error(exError.message)

      setSavedRoutine(true)
      setShowSaveRoutine(false)
    } catch (err: any) {
      alert(`Failed to save custom routine: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Token shorthands ─────────────────────────────────────

  const T = {
    bg: '#080808',
    card: '#101010',
    card2: '#151515',
    card3: '#1b1b1b',
    border: '#1d1d1d',
    border2: '#232323',
    text: '#f2f2f2',
    text2: '#a8a8a8',
    text3: '#3d3d3d',
    text4: '#222',
    accent: '#3ecf8e',
    accentBg: '#071410',
    accentBd: '#163020',
    amber: '#f5a623',
    amberBg: '#181000',
    amberBd: '#342200',
    orange: '#ff6b4a',
    red: '#ff3b5c',
  }

  const font = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'

  // ── Render ───────────────────────────────────────────────

  return (
    <div style={{ fontFamily: font, background: T.bg, color: T.text, minHeight: '100vh', overflowX: 'hidden', WebkitFontSmoothing: 'antialiased' }}>

      {/* CSS animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0}to{opacity:1} }
        @keyframes checkPop { 0%{transform:scale(0) rotate(-15deg);opacity:0} 65%{transform:scale(1.18) rotate(4deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes barGrow { from{width:0;opacity:0}to{opacity:1} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 0 0 rgba(62,207,142,0)} 50%{box-shadow:0 0 28px 4px rgba(62,207,142,0.22)} }
        @keyframes prGlow { 0%,100%{box-shadow:0 0 0 0 rgba(62,207,142,0)} 50%{box-shadow:0 0 40px 8px rgba(62,207,142,0.18)} }
        @keyframes countUp { from{opacity:0;transform:translateY(8px) scale(0.9)}to{opacity:1;transform:translateY(0) scale(1)} }
        .lf-a1{animation:fadeUp 0.55s cubic-bezier(.32,.72,0,1) 0.04s both}
        .lf-a2{animation:fadeUp 0.55s cubic-bezier(.32,.72,0,1) 0.12s both}
        .lf-a3{animation:fadeUp 0.55s cubic-bezier(.32,.72,0,1) 0.20s both}
        .lf-a4{animation:fadeUp 0.55s cubic-bezier(.32,.72,0,1) 0.28s both}
        .lf-a5{animation:fadeUp 0.55s cubic-bezier(.32,.72,0,1) 0.36s both}
        .lf-a6{animation:fadeUp 0.55s cubic-bezier(.32,.72,0,1) 0.44s both}
        .lf-a7{animation:fadeUp 0.55s cubic-bezier(.32,.72,0,1) 0.52s both}
        .lf-pr-hero{animation:prGlow 4s ease-in-out 0.8s infinite}
        .lf-pr-num{animation:countUp 0.6s cubic-bezier(.32,.72,0,1) 0.1s both}
        .lf-check{animation:checkPop 0.5s cubic-bezier(.32,.72,0,1) 0.4s both}
        .lf-ex-check{animation:checkPop 0.4s cubic-bezier(.32,.72,0,1) 0.6s both}
        .lf-pr-badge{animation:checkPop 0.4s cubic-bezier(.32,.72,0,1) 0.7s both}
        .lf-hdr{animation:fadeIn 0.3s ease both}
        .lf-done-glow{animation:glowPulse 3s ease-in-out infinite}
        .lf-completion{animation:fadeIn 0.25s ease both}
        .lf-comp-ring{animation:checkPop 0.55s cubic-bezier(.32,.72,0,1) 0.05s both}
        .lf-comp-title{animation:fadeUp 0.4s ease 0.25s both}
        .lf-comp-sub{animation:fadeUp 0.4s ease 0.35s both}
        .lf-comp-enc{animation:fadeUp 0.4s ease 0.45s both}
        .lf-wu-btn:hover{opacity:1!important}
        .lf-see-sets:hover{color:#3ecf8e!important}
      ` }} />

      {/* ── Scroll progress bar ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, height: 2, zIndex: 100,
        width: `${scrollPct}%`,
        background: '#3ecf8e',
        pointerEvents: 'none',
        transition: 'width 0.08s linear',
      }} />

      {/* ── Sticky header ── */}
      <header className="lf-hdr" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,8,0.96)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${T.border}`,
        padding: '12px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 32, height: 32, flexShrink: 0,
            background: T.card2, border: `1px solid ${T.border2}`,
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke={T.text2} strokeWidth="2.3">
            <polyline points="9,2 4,7 9,12" />
          </svg>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.3px', color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {routineName ?? 'Custom Workout'}
          </div>
          <div style={{ fontSize: 11, color: T.text3, marginTop: 1, letterSpacing: '-0.1px' }}>
            {completedAt ? formatWorkoutDate(completedAt) : ''}
            {completedAt ? ` · ${formatTime(completedAt)}` : ''}
            {durationMinutes ? ` · ${durationMinutes} min` : ''}
            {sets.length > 0 ? ` · ${totalVolume} kg` : ''}
          </div>
        </div>

        {isToday && (
          <div className="lf-check" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: isPartialSession ? 'rgba(255,170,0,0.1)' : T.accentBg,
            border: `1px solid ${isPartialSession ? 'rgba(255,170,0,0.35)' : T.accentBd}`,
            borderRadius: 20, padding: '5px 11px',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.3px',
            color: isPartialSession ? T.amber : T.accent,
            flexShrink: 0,
          }}>
            {!isPartialSession && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke={T.accent} strokeWidth="2.8">
                <polyline points="1,6 4.5,10 11,2" />
              </svg>
            )}
            {isPartialSession ? 'Partial' : 'Complete'}
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <div className="lf-a1" style={{
        padding: '32px 20px 28px',
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #0a1a12 0%, #080808 55%)',
      }}>
        {/* Atmospheric glow overlay */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(62,207,142,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Hero block — kicker + workout name headline + date */}
        <div style={{ marginBottom: 22, position: 'relative', zIndex: 1 }}>

          {/* Kicker label */}
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '2.2px', textTransform: 'uppercase',
            color: T.accent, opacity: 0.7, marginBottom: 10,
          }}>
            {heroCopy.label}
          </div>

          {/* PR number — large green number only when PRs exist */}
          {prs.length > 0 && (
            <div className="lf-pr-hero" style={{ marginBottom: 10 }}>
              <div className="lf-pr-num" style={{
                fontSize: 80, fontWeight: 900, letterSpacing: '-6px', lineHeight: 0.88,
                background: 'linear-gradient(135deg, #3ecf8e 0%, #5adfaa 40%, #3ecf8e 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                display: 'inline-block',
              }}>
                {prs.length}
              </div>
              <div style={{ fontSize: 12, color: T.text3, marginTop: 2, letterSpacing: '-0.1px' }}>
                {prs.slice(0, 3).join(' · ')}
              </div>
            </div>
          )}

          {/* Workout name — always the main headline */}
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1.2px', lineHeight: 1.05, color: T.text }}>
            {heroCopy.title}
          </div>

          {/* Date + time subtitle */}
          <div style={{ fontSize: 13, color: T.text2, marginTop: 4, letterSpacing: '-0.1px', lineHeight: 1.4 }}>
            <strong style={{ color: summaryMode === 'regression' ? T.amber : T.accent, fontWeight: 700 }}>{heroCopy.subtitle}</strong>
            {completedAt ? <> &nbsp;·&nbsp; {formatWorkoutDate(completedAt)}, {formatTime(completedAt)}</> : null}
          </div>
        </div>

        {/* Stat pills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, position: 'relative', zIndex: 1 }}>
          {statCards.map((stat) => (
            <div key={stat.label} style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${T.border2}`,
              borderRadius: 14, padding: '13px 8px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.6px', lineHeight: 1.05, color: T.text }}>
                {stat.val}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0', color: T.text2, marginTop: 6, lineHeight: 1.2 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Identity line */}
        <div style={{
          marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${T.border2}`,
          borderRadius: 14, position: 'relative', zIndex: 1,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: T.accent, flexShrink: 0, marginTop: 4,
            boxShadow: '0 0 10px rgba(62,207,142,0.7)',
          }} />
          <div style={{ fontSize: 12, fontWeight: 500, color: T.text2, lineHeight: 1.55, letterSpacing: '-0.1px' }}>
            {(() => {
              const primaryName = exerciseNames[0]
              const primaryToday = primaryName ? todayBest[primaryName]?.weight : null
              const primaryPrev  = primaryName ? prevBestWeight[primaryName] : null
              // Only show "X → Y" when there is a real difference — never show "Xkg → Xkg"
              const hasRealProgression = !isPartialSession
                && !isLowData
                && sessionCount >= 2
                && primaryName != null
                && primaryPrev != null
                && primaryToday != null
                && Math.abs(primaryToday - primaryPrev) > 0.01

              return (
                <>
                  Session{' '}
                  <strong style={{ color: T.text, fontWeight: 700 }}>{sessionCount}</strong>
                  {daysTraining > 1 && (
                    <> · Training for <strong style={{ color: T.text, fontWeight: 700 }}>{daysTraining} days</strong></>
                  )}
                  {isPartialSession ? (
                    <> · <em style={{ color: T.accent, fontStyle: 'normal', fontWeight: 700 }}>Partial session saved early.</em></>
                  ) : hasRealProgression ? (
                    <> · Your <strong style={{ color: T.text, fontWeight: 700 }}>{primaryName}</strong>{' '}
                    went from <strong style={{ color: T.text, fontWeight: 700 }}>{primaryPrev}kg</strong>
                    {' → '}
                    <em style={{ color: T.accent, fontStyle: 'normal', fontWeight: 700 }}>{primaryToday}kg</em>
                    {' '}this session.</>
                  ) : primaryName && primaryToday && sessionCount >= 2 && !isLowData ? (
                    <> · Building consistency at <em style={{ color: T.accent, fontStyle: 'normal', fontWeight: 700 }}>{primaryToday}kg</em>.</>
                  ) : prs.length > 0 && !isLowData ? (
                    <> · <em style={{ color: T.accent, fontStyle: 'normal', fontWeight: 700 }}>You're not the same person who walked in on day one.</em></>
                  ) : sessionCount >= 5 ? (
                    <> · <em style={{ color: T.accent, fontStyle: 'normal', fontWeight: 700 }}>Keep showing up.</em></>
                  ) : (
                    <> · <em style={{ color: T.accent, fontStyle: 'normal', fontWeight: 700 }}>The journey starts here.</em></>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── Coach card ── */}
      {exerciseNames.length > 0 && (
        <div className="lf-a2" style={{ padding: '20px 16px 0' }}>
          <div style={{
            background: T.accentBg, border: `1px solid ${T.accentBd}`,
            borderRadius: 22, padding: 20,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 34, height: 34,
                background: 'rgba(62,207,142,0.08)', border: `1px solid ${T.accentBd}`,
                borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: T.accent, opacity: 0.65 }}>Coach</div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px', color: T.text, marginTop: 1 }}>Coach Verdict</div>
              </div>
            </div>

            {/* Coach message */}
            <div style={{ fontSize: 15, lineHeight: 1.65, color: 'rgba(242,242,242,0.88)', marginBottom: 18, letterSpacing: '0', whiteSpace: 'pre-line' }}>
              {coachMessage}
            </div>

            {/* Per-exercise target rows */}
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.9px', textTransform: 'uppercase', color: T.accent, opacity: 0.9, marginBottom: 9 }}>
              Next Session Targets
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {exerciseNames.map(name => {
                const nextTarget = targets[name]?.[1]
                if (!nextTarget) return null
                const action = getTargetAction(name)
                const targetLoadLabel = isBodyweightExercise(name)
                  ? `${nextTarget.weight}kg added`
                  : `${nextTarget.weight}kg`
                return (
                  <div key={name} style={{
                    display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', padding: '12px', gap: 10,
                    background: 'rgba(62,207,142,0.04)',
                    border: '1px solid rgba(62,207,142,0.08)',
                    borderRadius: 10,
                  }}>
                    <div style={{ flex: '1 1 170px', minWidth: 0, lineHeight: 1.35 }}>
                      <div style={{ fontSize: 13, fontWeight: 750, color: T.text }}>
                        {name}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(242,242,242,0.72)', marginTop: 4, lineHeight: 1.45 }}>
                        Reason: {action.reason}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {targetLoadLabel} × {nextTarget.repsMin}–{nextTarget.repsMax}
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.2px',
                      padding: '4px 8px', borderRadius: 6, flexShrink: 0,
                      ...(action.tone === 'green'
                        ? { background: T.accentBg, color: T.accent,  border: `1px solid ${T.accentBd}` }
                        : { background: '#1a1200',  color: T.amber,   border: `1px solid ${T.amberBd}` }),
                    }}>
                      {action.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Section divider: Exercise Detail ── */}
      {exerciseNames.length > 0 && (
        <div className="lf-a3" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', margin: '24px 0 10px' }}>
          <div style={{ flex: 1, height: 1, background: T.border }} />
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.9px', textTransform: 'uppercase', color: T.text2, whiteSpace: 'nowrap' }}>Exercise Detail</div>
          <div style={{ flex: 1, height: 1, background: T.border }} />
        </div>
      )}

      {/* ── Exercise cards ── */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {exerciseNames.map((name, idx) => {
          const workingSets = sets.filter(s => s.exercise_name === name && s.set_type !== 'warmup')
          const warmupSets  = sets.filter(s => s.exercise_name === name && s.set_type === 'warmup')
          if (workingSets.length === 0 && warmupSets.length === 0) return null

          const exBest = todayBest[name]
          const isPR   = !isPartialSession && !isLowData && exBest && allTimeBest[name] > 0 && exBest.rm > allTimeBest[name]
          const isBaseline = exBest && !allTimeBest[name] && !prevBestWeight[name]
          const delta  = getDelta(name)

          const isPrimary     = idx === 0
          const isPrimaryBack = idx === 1
          const showWarmup    = idx < 2 && warmupSets.length > 0
          const backoffSets   = workingSets.slice(1)
          const showBackoffSets = backoffOpen[name] ?? workingSets.length <= 4

          const cardStyle: React.CSSProperties = {
            borderRadius: 20, overflow: 'hidden', position: 'relative',
            ...(isPrimary     ? { background: '#0d1410', borderTop: `2px solid ${T.accent}`,  border: `1px solid ${T.border2}`, borderTopWidth: 2, borderTopColor: T.accent }
              : isPrimaryBack ? { background: '#130f0d', borderTop: `2px solid ${T.orange}`,  border: `1px solid ${T.border2}`, borderTopWidth: 2, borderTopColor: T.orange }
                              : { background: T.card,    border: `1px solid ${T.border2}` }),
          }

          const animClass = idx === 0 ? 'lf-a3' : idx === 1 ? 'lf-a3' : idx <= 3 ? 'lf-a4' : 'lf-a5'

          return (
            <div key={name} className={animClass} style={cardStyle}>

              {/* Checkmark badge */}
              <div className="lf-ex-check" style={{
                position: 'absolute', top: 14, right: 16,
                width: 20, height: 20,
                background: T.accentBg, border: `1px solid ${T.accentBd}`,
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke={T.accent} strokeWidth="2.8">
                  <polyline points="1.5,5 4,8 8.5,2" />
                </svg>
              </div>

              {/* Exercise header */}
              <div style={{ padding: '14px 44px 0 16px' }}>
                {/* Name + PR badge */}
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.3px', color: T.text, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  {name}
                  {isPR && (
                    <span className="lf-pr-badge" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      background: T.accentBg, border: `1px solid ${T.accentBd}`,
                      borderRadius: 6, padding: '2px 7px',
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.4px',
                      color: T.accent, textTransform: 'uppercase', flexShrink: 0,
                    }}>
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.8">
                        <polyline points="1,5 3.5,8 9,2" />
                      </svg>
                      PR
                    </span>
                  )}
                  {!isPR && isBaseline && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      background: '#1a1200', border: `1px solid ${T.amberBd}`,
                      borderRadius: 6, padding: '2px 7px',
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.4px',
                      color: T.amber, textTransform: 'uppercase', flexShrink: 0,
                    }}>
                      Baseline
                    </span>
                  )}
                </div>

                {/* Best set headline + delta */}
                {exBest && (
                  <div style={{
                    marginTop: 6, paddingBottom: 14,
                    display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap',
                    borderBottom: `1px solid ${T.border}`,
                  }}>
                    <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-1.2px', color: T.text, lineHeight: 1 }}>
                      {exBest.weight}kg
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text2 }}>
                      × {exBest.reps} reps
                    </span>
                      <span style={{ fontSize: 12, color: T.text2 }}>
                      Est. 1RM: {exBest.rm.toFixed(1)}
                    </span>
                    {/* Delta badge */}
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                      padding: '3px 8px', borderRadius: 6, flexShrink: 0, alignSelf: 'center',
                      ...(delta.type === 'up'   ? { color: T.accent, background: T.accentBg, border: `1px solid ${T.accentBd}` }
                        : delta.type === 'down' ? { color: T.red,    background: '#1a0810',  border: '1px solid #3a1020' }
                                                : { color: '#d4b800', background: '#1a1a00', border: '1px solid #3a3800' }),
                    }}>
                      {delta.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Warm-up chip (first 2 exercises only) */}
              {showWarmup && (
                <>
                  <button
                    className="lf-wu-btn"
                    onClick={() => setWarmupOpen(prev => ({ ...prev, [name]: !prev[name] }))}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      margin: '8px 16px',
                      padding: '4px 9px',
                      background: 'none', border: `1px solid ${T.amberBd}`,
                      borderRadius: 7, cursor: 'pointer',
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.3px',
                      color: T.amber, opacity: warmupOpen[name] ? 1 : 0.6,
                      fontFamily: font,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <svg
                      width="9" height="9" viewBox="0 0 10 10" fill="none"
                      stroke="currentColor" strokeWidth="2"
                      style={{ transform: warmupOpen[name] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    >
                      <polyline points="2,3 5,7 8,3" />
                    </svg>
                    {warmupSets.length} warm-up set{warmupSets.length !== 1 ? 's' : ''}
                  </button>
                  {warmupOpen[name] && (
                    <div style={{ padding: '4px 16px 8px', background: 'rgba(245,166,35,0.03)', borderTop: `1px solid ${T.amberBg}` }}>
                      {warmupSets.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: T.amber, width: 18, flexShrink: 0, opacity: 0.85 }}>W{i + 1}</span>
                          <span style={{ color: T.text2 }}>{s.weight_kg}kg</span>
                          <span style={{ color: T.text4 }}> × </span>
                          <span style={{ color: T.text2 }}>{s.reps_completed}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Sets table */}
              {workingSets.length > 0 && (
                <div style={{ paddingBottom: 6 }}>
                  {/* Column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '22px 90px 1fr 64px', padding: '6px 16px', gap: 8 }}>
                    {['#', 'Weight', 'Reps', 'Est. 1RM'].map((h, i) => (
                      <div key={h} style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: '0.4px',
                        textTransform: 'uppercase', color: T.text2,
                        textAlign: i === 2 ? 'center' : i === 3 ? 'right' : 'left',
                      }}>{h}</div>
                    ))}
                  </div>

                  {/* Best set (always visible) */}
                  {(() => {
                    const s = workingSets[0]
                    const rm = epley1RM(s.weight_kg, s.reps_completed)
                    return (
                      <div style={{
                        display: 'grid', gridTemplateColumns: '22px 90px 1fr 64px',
                        padding: '9px 16px', gap: 8, alignItems: 'center',
                        background: '#0c180e',
                        borderLeft: `3px solid ${T.accent}`,
                        paddingLeft: 13,
                        borderTop: '1px solid #0c0c0c',
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.accent }}>{s.set_number}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: '-0.3px' }}>{s.weight_kg}kg</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, textAlign: 'center' }}>{s.reps_completed}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, textAlign: 'right', letterSpacing: '-0.1px' }}>{rm.toFixed(1)}</div>
                      </div>
                    )
                  })()}

                  {/* Back-off sets toggle */}
                  {backoffSets.length > 0 && (
                    <>
                      <button
                        className="lf-see-sets"
                        onClick={() => setBackoffOpen(prev => ({ ...prev, [name]: !prev[name] }))}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '8px 16px 10px', gap: 5,
                          fontSize: 12, fontWeight: 650, color: T.text2,
                          cursor: 'pointer',
                          background: 'none', border: 'none', borderTop: '1px solid #0c0c0c',
                          width: '100%', fontFamily: font,
                          transition: 'color 0.15s',
                        }}
                      >
                        <svg
                          width="10" height="10" viewBox="0 0 10 10" fill="none"
                          stroke="currentColor" strokeWidth="2"
                          style={{ transform: backoffOpen[name] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                        >
                          <polyline points="2,3 5,7 8,3" />
                        </svg>
                        {showBackoffSets ? 'Hide' : 'Show'} {backoffSets.length} more set{backoffSets.length !== 1 ? 's' : ''}
                      </button>

                      {showBackoffSets && backoffSets.map((s, i) => {
                        const rm = epley1RM(s.weight_kg, s.reps_completed)
                        return (
                          <div key={i} style={{
                            display: 'grid', gridTemplateColumns: '22px 90px 1fr 64px',
                            padding: '9px 16px', gap: 8, alignItems: 'center',
                            borderTop: '1px solid #0c0c0c',
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: T.text2 }}>{s.set_number}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: '-0.3px' }}>{s.weight_kg}kg</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, textAlign: 'center' }}>{s.reps_completed}</div>
                            <div style={{ fontSize: 12, fontWeight: 650, color: T.text2, textAlign: 'right', letterSpacing: '-0.1px' }}>{rm.toFixed(1)}</div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Section divider: Muscle Split ── */}
      {showMuscleSplit && (
        <div className="lf-a6" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', margin: '24px 0 10px' }}>
          <div style={{ flex: 1, height: 1, background: T.border }} />
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: T.text3, whiteSpace: 'nowrap' }}>Muscle Split</div>
          <div style={{ flex: 1, height: 1, background: T.border }} />
        </div>
      )}

      {/* ── Muscle split card ── */}
      {showMuscleSplit && (
        <div className="lf-a6" style={{ padding: '0 16px' }}>
          <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 20, padding: '16px 18px' }}>
            {/* Bar */}
            <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', gap: 2, marginBottom: 14 }}>
              {muscleSplit.map(m => (
                <div key={m.muscle} style={{ width: `${m.pct}%`, height: '100%', background: m.color, borderRadius: 3 }} />
              ))}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
              {muscleSplit.map(m => (
                <div key={m.muscle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.text2 }}>{m.muscle}</span>
                  <span style={{ fontSize: 11, color: T.text3 }}>{m.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom CTAs ── */}
      <div className="lf-a7" style={{ padding: '24px 16px 32px' }}>
        {/* Divider */}
        <div style={{ height: 1, background: T.border, marginBottom: 20 }} />

        {/* Save as custom routine (only if no existing routine and not yet saved) */}
        {!routineId && !savedRoutine && (
          <button
            onClick={() => setShowSaveRoutine(true)}
            style={{
              width: '100%', padding: 12,
              background: 'none', border: `1px solid ${T.border2}`,
              borderRadius: 13, fontFamily: font,
              fontSize: 12, fontWeight: 600, color: T.text3,
              cursor: 'pointer', marginBottom: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              letterSpacing: '-0.1px',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17,21 17,13 7,13 7,21" />
              <polyline points="7,3 7,8 15,8" />
            </svg>
            Save as custom routine
          </button>
        )}

        {savedRoutine && (
          <div style={{ textAlign: 'center', fontSize: 12, color: T.accent, marginBottom: 10, padding: '12px 0' }}>
            Custom routine saved!
          </div>
        )}

        {/* Done button */}
        <button
          onClick={handleDone}
          className={doneReady ? 'lf-done-glow' : ''}
          style={{
            width: '100%', padding: 17,
            background: T.accent, border: 'none', borderRadius: 16,
            fontFamily: font,
            fontSize: 16, fontWeight: 800, letterSpacing: '0.1px',
            color: '#000', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'opacity 0.2s, transform 0.15s',
          }}
        >
          Done
        </button>
      </div>

      {/* ── Completion ritual overlay ── */}
      {showCompletion && (
        <div
          className="lf-completion"
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: T.bg,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14,
            opacity: completionFading ? 0 : 1,
            transition: completionFading ? 'opacity 0.6s ease' : 'none',
          }}
        >
          <div className="lf-comp-ring" style={{
            width: 88, height: 88,
            background: T.accentBg, border: `2px solid ${T.accentBd}`,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 50px rgba(62,207,142,0.25)',
          }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4,12 9,17 20,6" />
            </svg>
          </div>
          <div className="lf-comp-title" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-1px', color: T.text }}>
            {isPartialSession ? 'Finished Early' : 'Session Complete'}
          </div>
          <div className="lf-comp-sub" style={{ fontSize: 14, color: T.text2, letterSpacing: '-0.2px' }}>
            {routineName ?? 'Custom Workout'}{sessionCount > 1 ? ` · ${sessionCount} sessions` : ''}
          </div>
          <div className="lf-comp-enc" style={{ fontSize: 13, color: T.accent, fontWeight: 600, letterSpacing: '-0.1px' }}>
            {isPartialSession ? 'Partial session saved.' : 'Keep showing up.'}
          </div>
        </div>
      )}

      {/* ── Save as custom routine modal ── */}
      {showSaveRoutine && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)' }}>
          <div style={{
            width: '100%',
            background: '#0d0d0d', borderTop: '1px solid #222',
            borderRadius: '24px 24px 0 0', padding: 24,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>Save as custom routine</div>
            <div style={{ fontSize: 12, color: T.text3, marginBottom: 16, fontFamily: 'monospace' }}>
              {exerciseNames.length} exercises · saves targets for next session
            </div>
            <input
              type="text"
              value={routineNameInput}
              onChange={e => setRoutineNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveAsRoutine()}
              autoFocus
              placeholder="e.g. Push Day"
              style={{
                width: '100%',
                background: '#111', border: '1px solid #222',
                borderRadius: 14, padding: '12px 16px',
                fontSize: 14, color: T.text, fontFamily: font,
                outline: 'none', marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setShowSaveRoutine(false); setRoutineNameInput('') }}
                style={{
                  flex: 1, padding: 14,
                  background: 'none', border: '1px solid #222',
                  borderRadius: 14, fontFamily: font,
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.5px',
                  color: T.text3, cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={saveAsRoutine}
                disabled={!routineNameInput.trim() || saving}
                style={{
                  flex: 1, padding: 14,
                  background: T.accent, border: 'none',
                  borderRadius: 14, fontFamily: font,
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.5px',
                  color: '#000', cursor: 'pointer',
                  opacity: (!routineNameInput.trim() || saving) ? 0.4 : 1,
                }}
              >
                {saving ? 'SAVING...' : 'SAVE'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
