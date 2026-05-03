'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeWarmupSets } from '@/lib/warmup'
import { DELOAD_FACTOR, EXERCISE_TYPE, WEIGHT_INCREMENT, PRIMARY_COMPOUNDS, isBodyweightExercise } from '@/lib/progressionConfig'

// ─── How To Modal ─────────────────────────────────────────────────────────────

function HowToModal({ exerciseName, onClose }: { exerciseName: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    gifUrl: string | null
    instructions: string[]
    targetMuscle: string | null
    secondaryMuscles: string[]
  } | null>(null)

  useEffect(() => {
    fetch(`/api/exercise-media?name=${encodeURIComponent(exerciseName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => { setData(json); setLoading(false) })
      .catch(() => setLoading(false))
  }, [exerciseName])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1a] flex-shrink-0">
        <button onClick={onClose} className="text-[#b8b8b8] hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <p className="text-sm font-bold text-white truncate">{exerciseName}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex items-center gap-2 py-4">
            <div className="w-4 h-4 border border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[#b8b8b8] font-mono">Loading...</span>
          </div>
        )}
        {!loading && !data && (
          <p className="text-xs text-[#b8b8b8] font-mono py-4">No instructions found for this exercise.</p>
        )}
        {!loading && data && (
          <div className="space-y-4">
            {data.gifUrl ? (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.gifUrl} alt={exerciseName} className="rounded-lg max-h-64 object-contain" />
              </div>
            ) : (
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(exerciseName + ' proper form tutorial')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-3 w-full py-8 rounded-lg bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#888888] transition-colors"
              >
                <svg width="48" height="34" viewBox="0 0 48 34" fill="none">
                  <rect width="48" height="34" rx="8" fill="#FF0000"/>
                  <path d="M19 10L34 17L19 24V10Z" fill="white"/>
                </svg>
                <div className="text-center">
                  <p className="text-xs font-bold text-white font-mono">{exerciseName.toUpperCase()}</p>
                  <p className="text-[10px] text-[#b8b8b8] font-mono mt-1">TAP TO WATCH FORM GUIDE</p>
                </div>
              </a>
            )}
            {data.targetMuscle && (
              <p className="text-[10px] text-[#b8b8b8] font-mono">
                Target: <span className="text-[#888]">{data.targetMuscle}</span>
                {data.secondaryMuscles.length > 0 && (
                  <> · Secondary: <span className="text-[#888]">{data.secondaryMuscles.join(', ')}</span></>
                )}
              </p>
            )}
            {data.instructions.length > 0 && (
              <ol className="space-y-2">
                {data.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-xs text-[#888]">
                    <span className="text-primary font-mono font-bold flex-shrink-0">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

type WorkoutExercise = {
  id: string
  exercise_name: string
  sets_target: number
  reps_min: number
  reps_max: number
  rest_seconds: number
  notes: string | null
}

type SetState = {
  weight: string
  reps: string
  logged: boolean
  isPR: boolean
  setType: 'warmup' | 'working'
  warmupRestSeconds?: number  // only for warmup sets: how long to rest after this set
}

interface Props {
  workoutId: string
  routineName: string | null
  initialExercises: WorkoutExercise[]
  suggestedTargets: Record<string, Record<number, { weight: number; repsMin: number; repsMax: number; consecutiveMax: number; consecutiveFail: number }>>
  lastSession: Record<string, Record<number, { weight: number; reps: number }>>
}

// ─── Sound synthesis ──────────────────────────────────────────────────────────

function playSetSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
  } catch {}
}

function playPRSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const tones = [
      { freq: 1046, start: 0, dur: 0.15 },
      { freq: 1318, start: 0.12, dur: 0.15 },
      { freq: 1568, start: 0.24, dur: 0.35 },
    ]
    tones.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(0.25, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur)
    })
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function epley1RM(weight: number, reps: number) {
  return weight * (1 + reps / 30)
}

function prevSessionBest1RM(sessionSets: Record<number, { weight: number; reps: number }>) {
  return Object.values(sessionSets).reduce((max, s) => {
    const rm = epley1RM(s.weight, s.reps)
    return rm > max ? rm : max
  }, 0)
}

function computeFallbackTargets(
  exercise: { sets_target: number; reps_min: number; reps_max: number; exercise_name: string },
  lastSess: Record<number, { weight: number; reps: number }>
): Record<number, { weight: number; repsMin: number; repsMax: number }> {
  const workingSets = Object.values(lastSess)
  if (workingSets.length === 0) return {}
  const topSet = workingSets.reduce((best, s) => s.weight > best.weight ? s : best, workingSets[0])

  const allHitMax = workingSets.length >= exercise.sets_target && Object.values(lastSess).every(s => s.reps >= exercise.reps_max)
  const increment = WEIGHT_INCREMENT[EXERCISE_TYPE[exercise.exercise_name] ?? 'isolation']
  const nextWeight = allHitMax ? topSet.weight + increment : topSet.weight

  const totalSets = exercise.sets_target
  const result: Record<number, { weight: number; repsMin: number; repsMax: number }> = {}
  for (let i = 0; i < totalSets; i++) {
    const setWeight = i === 0 ? nextWeight
      : i === 1 ? Math.round(nextWeight * 0.90 / 2.5) * 2.5
      :           Math.round(nextWeight * 0.80 / 2.5) * 2.5
    result[i + 1] = { weight: setWeight, repsMin: exercise.reps_min, repsMax: exercise.reps_max }
  }
  return result
}

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

function buildInitialSets(count: number, type: 'warmup' | 'working' = 'working'): SetState[] {
  return Array.from({ length: count }, () => ({
    weight: '',
    reps: '',
    logged: false,
    isPR: false,
    setType: type,
  }))
}

function buildSetsForExercise(
  exercise: { sets_target: number; reps_min: number; reps_max: number; exercise_name: string },
  resolvedTargets: Record<number, { weight: number; repsMin: number; repsMax: number }>
): SetState[] {
  const workingSet1 = resolvedTargets[1]
  const isPrimaryCompound = PRIMARY_COMPOUNDS.includes(exercise.exercise_name)
  const shouldUseWarmups = isPrimaryCompound && !isBodyweightExercise(exercise.exercise_name)
  const warmups = (shouldUseWarmups && workingSet1) ? computeWarmupSets(workingSet1.weight) : []

  const warmupStates: SetState[] = warmups.map(w => ({
    weight: String(w.weight),
    reps: String(w.reps),
    logged: false,
    isPR: false,
    setType: 'warmup',
    warmupRestSeconds: w.restSeconds,
  }))

  const workingStates: SetState[] = Array.from({ length: exercise.sets_target }, (_, i) => {
    const target = resolvedTargets[i + 1]
    return {
      weight: target ? String(target.weight) : '',
      reps: '',
      logged: false,
      isPR: false,
      setType: 'working',
    }
  })

  return [...warmupStates, ...workingStates]
}

type ParsedSetInputs =
  | { ok: true; weight: number; reps: number }
  | { ok: false; error: string }

function parseSetInputs(
  exercise: { exercise_name: string },
  setData: SetState
): ParsedSetInputs {
  const weightText = setData.weight.trim()
  const repsText = setData.reps.trim()
  const weight = Number(weightText)
  const reps = Number(repsText)
  const bodyweight = isBodyweightExercise(exercise.exercise_name)

  if (!repsText || !Number.isFinite(reps) || !Number.isInteger(reps) || reps <= 0) {
    return { ok: false, error: 'Reps must be a positive whole number.' }
  }

  if (!weightText || !Number.isFinite(weight)) {
    return { ok: false, error: bodyweight ? 'Added kg must be 0 or more. Use 0 for bodyweight.' : 'Weight must be a valid number.' }
  }

  if (weight < 0) {
    return { ok: false, error: bodyweight ? 'Added kg cannot be negative.' : 'Weight cannot be negative.' }
  }

  if (!bodyweight && weight <= 0) {
    return { ok: false, error: 'Weight must be greater than 0 kg.' }
  }

  return { ok: true, weight, reps }
}

// ─── Rest Timer ───────────────────────────────────────────────────────────────

function RestTimer({
  seconds,
  onDone,
  onFinishWorkout,
  finishing,
}: {
  seconds: number
  onDone: () => void
  onFinishWorkout: () => void
  finishing: boolean
}) {
  const [remaining, setRemaining] = useState(seconds)
  const [totalSeconds, setTotalSeconds] = useState(seconds)
  // Store onDone in a ref so the effect never re-runs due to a new function reference
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Boxing bell — three strikes using Web Audio API synthesis
  const playBell = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const strike = (t: number) => {
        // Bell harmonics: fundamental + 3 overtones for a metallic ring
        const freqs  = [800, 1200, 1600, 2400]
        const amps   = [0.30, 0.18, 0.12, 0.06]
        freqs.forEach((freq, i) => {
          const osc  = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = freq
          osc.type = 'sine'
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(amps[i], t + 0.005) // sharp attack
          gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0) // ring out
          osc.start(t)
          osc.stop(t + 2.0)
        })
      }
      const now = ctx.currentTime
      strike(now)         // DING
      strike(now + 0.40)  // DING
      strike(now + 0.80)  // DING — three strikes like a boxing bell
    } catch {
      // Web Audio not available — fail silently
    }
  }, [])

  useEffect(() => {
    if (remaining <= 0) { playBell(); onDoneRef.current(); return }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining, playBell]) // only re-run when remaining changes, not onDone

  const adjust = (delta: number) => {
    setRemaining(r => {
      const next = Math.max(0, r + delta)
      setTotalSeconds(t => Math.max(t, next))
      return next
    })
  }

  const pct = totalSeconds > 0 ? Math.min(100, ((totalSeconds - remaining) / totalSeconds) * 100) : 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      {/* X close button */}
      <button
        onClick={() => onDoneRef.current()}
        className="absolute top-6 right-6 text-[#b8b8b8] hover:text-white transition-colors"
        aria-label="Close rest timer"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="text-center px-8">
        <p className="text-[10px] tracking-widest text-[#b8b8b8] mb-6 font-mono">REST</p>
        <p
          className="text-8xl font-bold text-primary font-mono tabular-nums"
          style={{ textShadow: '0 0 40px #00FF41' }}
        >
          {remaining}
        </p>
        <div className="mt-6 w-56 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mx-auto">
          <div
            className="h-full bg-primary rounded-full transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* +/- 15s controls */}
        <div className="flex items-center justify-center gap-8 mt-8">
          <button
            onClick={() => adjust(-15)}
            className="w-14 h-14 rounded-full border border-[#888888] text-[#aaa] hover:border-[#666] hover:text-white transition-all font-mono text-sm font-bold"
          >
            −15
          </button>
          <button
            onClick={() => onDoneRef.current()}
            className="text-[10px] tracking-widest text-[#b8b8b8] hover:text-white transition-colors font-mono"
          >
            SKIP
          </button>
          <button
            onClick={() => adjust(+15)}
            className="w-14 h-14 rounded-full border border-[#888888] text-[#aaa] hover:border-[#666] hover:text-white transition-all font-mono text-sm font-bold"
          >
            +15
          </button>
        </div>

        <button
          onClick={onFinishWorkout}
          disabled={finishing}
          className="mt-8 w-56 rounded-xl bg-primary px-4 py-3 text-xs font-bold tracking-widest text-black transition-all disabled:opacity-50"
        >
          {finishing ? 'SAVING...' : 'FINISH WORKOUT'}
        </button>
      </div>
    </div>
  )
}

// ─── Add Exercise Modal ───────────────────────────────────────────────────────

const COMMON_EXERCISES = [
  'Barbell Bench Press', 'Barbell Row', 'Barbell Squat', 'Deadlift', 'Romanian Deadlift',
  'Overhead Press', 'Pull-Up', 'Lat Pulldown', 'Incline Barbell Press', 'Flat Dumbbell Press',
  'Incline Dumbbell Press', 'Dumbbell Row', 'Dumbbell Shoulder Press', 'Face Pull',
  'Lateral Raise', 'Cable Lateral Raise', 'Cable Row', 'Leg Press', 'Leg Curl',
  'Seated Leg Curl', 'Leg Extension', 'Calf Raise', 'Hip Thrust', 'Bulgarian Split Squat',
  'Tricep Pushdown', 'Skull Crusher', 'Bicep Curl', 'Hammer Curl', 'Preacher Curl',
  'Cable Fly', 'Pec Deck', 'Chest Dip', 'Seated Cable Row',
  'T-Bar Row', 'Hack Squat', 'Smith Machine Squat', 'Glute Kickback', 'Ab Crunch',
]

function AddExerciseModal({ onAdd, onClose }: { onAdd: (name: string) => Promise<void> | void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = query.trim()
    ? COMMON_EXERCISES.filter(e => e.toLowerCase().includes(query.toLowerCase()))
    : COMMON_EXERCISES

  const isExact = COMMON_EXERCISES.some(e => e.toLowerCase() === query.trim().toLowerCase())
  const canAddCustom = query.trim().length > 2 && !isExact

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1a] flex-shrink-0">
        <button onClick={onClose} className="text-[#b8b8b8] hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search exercises..."
          className="flex-1 bg-transparent text-white text-sm placeholder-[#b8b8b8] focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-[#b8b8b8] hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {canAddCustom && (
          <button
            onClick={() => onAdd(query.trim())}
            className="w-full px-4 py-3.5 text-left text-sm text-primary border-b border-[#111] hover:bg-[#0a0a0a] transition-colors"
          >
            + Add &quot;{query.trim()}&quot;
          </button>
        )}
        {filtered.length === 0 && !canAddCustom && (
          <p className="text-center text-[#b8b8b8] text-sm py-12">No exercises found.</p>
        )}
        {filtered.map(ex => (
          <button
            key={ex}
            onClick={() => onAdd(ex)}
            className="w-full px-4 py-3.5 text-left text-sm text-white border-b border-[#0d0d0d] hover:bg-[#0a0a0a] transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ActiveWorkoutClient({
  workoutId,
  routineName,
  initialExercises,
  suggestedTargets,
  lastSession,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [exercises, setExercises] = useState<WorkoutExercise[]>(initialExercises)
  const [sets, setSets] = useState<Record<string, SetState[]>>(() =>
    Object.fromEntries(initialExercises.map(ex => {
      const lastSess = lastSession[ex.exercise_name]
      const resolvedTargets = suggestedTargets[ex.exercise_name] ??
        (lastSess && Object.keys(lastSess).length > 0 ? computeFallbackTargets(ex, lastSess) : {})
      return [ex.id, buildSetsForExercise(ex, resolvedTargets)]
    }))
  )
  const [restTimer, setRestTimer] = useState<{ active: boolean; seconds: number }>({ active: false, seconds: 120 })
  const [finishing, setFinishing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [startTime] = useState(Date.now())
  const [showOptionsFor, setShowOptionsFor] = useState<string | null>(null)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [showNotesFor, setShowNotesFor] = useState<string | null>(null)
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({})
  const [showHowToFor, setShowHowToFor] = useState<string | null>(null)

  // Dynamic targets fetched client-side when exercises are added mid-workout
  const [dynamicTargets, setDynamicTargets] = useState<Record<string, Record<number, { weight: number; repsMin: number; repsMax: number; consecutiveMax: number; consecutiveFail: number }>>>({})
  const [dynamicLastSession, setDynamicLastSession] = useState<Record<string, Record<number, { weight: number; reps: number }>>>({})
  const [fetchingTargetsFor, setFetchingTargetsFor] = useState<Set<string>>(new Set())
  const [keepSameWeightFor, setKeepSameWeightFor] = useState<Set<string>>(new Set())
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [editingSet, setEditingSet] = useState<Set<string>>(new Set())
  const [setErrors, setSetErrors] = useState<Record<string, string>>({})

  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore draft on mount — merge logged/weight/reps back into initialized sets
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`lazyfit_workout_draft_${workoutId}`)
      if (!raw) return
      const parsed: { sets: Record<string, SetState[]> } = JSON.parse(raw)
      if (!parsed?.sets) return
      setSets(prev => {
        const merged: Record<string, SetState[]> = { ...prev }
        for (const [exId, draftSets] of Object.entries(parsed.sets)) {
          if (!merged[exId]) continue
          merged[exId] = merged[exId].map((s, i) => {
            const d = draftSets[i]
            if (!d) return s
            return { ...s, logged: d.logged ?? s.logged, weight: d.weight || s.weight, reps: d.reps || s.reps, isPR: d.isPR ?? s.isPR }
          })
        }
        return merged
      })
    } catch {}
  }, [workoutId])

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(t)
  }, [startTime])

  const updateSet = (exId: string, idx: number, field: 'weight' | 'reps', value: string) => {
    const errorKey = `${exId}-${idx}`
    setSetErrors(prev => {
      if (!prev[errorKey]) return prev
      const next = { ...prev }
      delete next[errorKey]
      return next
    })
    setSets(prev => {
      const next = { ...prev, [exId]: prev[exId].map((s, i) => i === idx ? { ...s, [field]: value } : s) }
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
      draftTimerRef.current = setTimeout(() => {
        try { localStorage.setItem(`lazyfit_workout_draft_${workoutId}`, JSON.stringify({ workoutId, savedAt: Date.now(), sets: next })) } catch {}
      }, 500)
      return next
    })
  }

  const logSet = async (exercise: WorkoutExercise, setIdx: number) => {
    const exSets = sets[exercise.id]
    const setData = exSets[setIdx]
    const isWarmup = setData.setType === 'warmup'

    // Compute separate set_number for warmup vs working sets
    const dbSetNumber = isWarmup
      ? exSets.slice(0, setIdx + 1).filter(s => s.setType === 'warmup').length
      : exSets.slice(0, setIdx + 1).filter(s => s.setType === 'working').length

    // Require explicit user input; placeholders/suggestions are not saved automatically.
    const parsed = parseSetInputs(exercise, setData)
    if (!parsed.ok) {
      setSetErrors(prev => ({ ...prev, [`${exercise.id}-${setIdx}`]: parsed.error }))
      return
    }
    setSetErrors(prev => {
      const next = { ...prev }
      delete next[`${exercise.id}-${setIdx}`]
      return next
    })

    const weight = parsed.weight
    const reps = parsed.reps

    const { error } = await supabase.from('workout_sets').upsert({
      workout_id: workoutId,
      exercise_name: exercise.exercise_name,
      set_number: dbSetNumber,
      weight_kg: weight,
      reps_completed: reps,
      set_type: isWarmup ? 'warmup' : 'working',
    }, { onConflict: 'workout_id,exercise_name,set_number,set_type' })

    if (error) { console.error('logSet error:', error.message, error.code, error.details); alert(`Failed to log set: ${error.message}`); return }

    // PR detection only on working sets
    const isPR = !isWarmup && (() => {
      const curr1RM = epley1RM(weight, reps)
      const prevBest = prevSessionBest1RM(
        lastSession[exercise.exercise_name] ?? dynamicLastSession[exercise.exercise_name] ?? {}
      )
      return prevBest > 0 && curr1RM > prevBest
    })()

    const updatedSets = {
      ...sets,
      [exercise.id]: sets[exercise.id].map((s, i) =>
        i === setIdx ? { ...s, logged: true, weight: String(weight), reps: String(reps), isPR } : s
      ),
    }
    try { localStorage.setItem(`lazyfit_workout_draft_${workoutId}`, JSON.stringify({ workoutId, savedAt: Date.now(), sets: updatedSets })) } catch {}
    setSets(updatedSets)

    if (isPR) {
      playPRSound()
    } else {
      playSetSound()
    }

    // Warm-up sets use their science-based rest; working sets use exercise rest
    const restSecs = isWarmup
      ? (setData.warmupRestSeconds ?? 60)
      : (exercise.rest_seconds || 120)
    setRestTimer({ active: true, seconds: restSecs })
  }

  const relogSet = async (exercise: WorkoutExercise, setIdx: number) => {
    const exSets = sets[exercise.id]
    const setData = exSets[setIdx]
    const isWarmup = setData.setType === 'warmup'

    const dbSetNumber = isWarmup
      ? exSets.slice(0, setIdx + 1).filter(s => s.setType === 'warmup').length
      : exSets.slice(0, setIdx + 1).filter(s => s.setType === 'working').length

    const parsed = parseSetInputs(exercise, setData)
    if (!parsed.ok) {
      setSetErrors(prev => ({ ...prev, [`${exercise.id}-${setIdx}`]: parsed.error }))
      return
    }
    setSetErrors(prev => {
      const next = { ...prev }
      delete next[`${exercise.id}-${setIdx}`]
      return next
    })

    const weight = parsed.weight
    const reps = parsed.reps

    const { error } = await supabase.from('workout_sets').upsert({
      workout_id:     workoutId,
      exercise_name:  exercise.exercise_name,
      set_number:     dbSetNumber,
      weight_kg:      weight,
      reps_completed: reps,
      set_type:       isWarmup ? 'warmup' : 'working',
    }, { onConflict: 'workout_id,exercise_name,set_number,set_type' })

    if (error) { alert(`Failed to update set: ${error.message}`); return }

    setEditingSet(prev => {
      const next = new Set(prev)
      next.delete(`${exercise.id}-${setIdx}`)
      return next
    })

    const updatedSets = {
      ...sets,
      [exercise.id]: sets[exercise.id].map((s, i) =>
        i === setIdx ? { ...s, weight: String(weight), reps: String(reps) } : s
      ),
    }
    try { localStorage.setItem(`lazyfit_workout_draft_${workoutId}`, JSON.stringify({ workoutId, savedAt: Date.now(), sets: updatedSets })) } catch {}
    setSets(updatedSets)
  }

  const addSet = (exId: string) => {
    setSets(prev => {
      const existing = prev[exId] ?? []
      const lastWorking = [...existing].filter(s => s.setType === 'working').reverse().find(s => s.logged)
      return {
        ...prev,
        [exId]: [
          ...existing,
          { weight: lastWorking?.weight ?? '', reps: lastWorking?.reps ?? '', logged: false, isPR: false, setType: 'working' },
        ],
      }
    })
  }

  const addWarmupSet = (exId: string) => {
    setSets(prev => {
      const existing = prev[exId] ?? []
      const lastWarmup = [...existing].filter(s => s.setType === 'warmup').reverse()[0]
      // Insert before the first working set
      const firstWorkingIdx = existing.findIndex(s => s.setType === 'working')
      const insertAt = firstWorkingIdx === -1 ? existing.length : firstWorkingIdx
      const newSet: SetState = {
        weight: lastWarmup?.weight ?? '',
        reps: '',
        logged: false,
        isPR: false,
        setType: 'warmup',
        warmupRestSeconds: 60,
      }
      return {
        ...prev,
        [exId]: [...existing.slice(0, insertAt), newSet, ...existing.slice(insertAt)],
      }
    })
  }

  const removeSet = async (exId: string, idx: number) => {
    const exercise = exercises.find(e => e.id === exId)
    const exSets = sets[exId] ?? []
    const setData = exSets[idx]

    if (!setData) return

    if (setData.logged && exercise) {
      const isWarmup = setData.setType === 'warmup'
      const dbSetNumber = isWarmup
        ? exSets.slice(0, idx + 1).filter(s => s.setType === 'warmup').length
        : exSets.slice(0, idx + 1).filter(s => s.setType === 'working').length

      const { error } = await supabase
        .from('workout_sets')
        .delete()
        .eq('workout_id', workoutId)
        .eq('exercise_name', exercise.exercise_name)
        .eq('set_number', dbSetNumber)
        .eq('set_type', isWarmup ? 'warmup' : 'working')

      if (error) {
        alert(`Failed to delete set: ${error.message}`)
        return
      }
    }

    setSets(prev => ({
      ...prev,
      [exId]: prev[exId].filter((_, i) => i !== idx),
    }))
    setSetErrors(prev => {
      const next = { ...prev }
      delete next[`${exId}-${idx}`]
      return next
    })
  }

  const toggleSetType = (exId: string, idx: number) => {
    setSets(prev => ({
      ...prev,
      [exId]: prev[exId].map((s, i) =>
        i === idx ? { ...s, setType: s.setType === 'warmup' ? 'working' : 'warmup', isPR: false } : s
      ),
    }))
  }

  const removeExercise = (exId: string) => {
    setExercises(prev => prev.filter(e => e.id !== exId))
    setSetErrors(prev => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${exId}-`)) delete next[key]
      }
      return next
    })
    setSets(prev => {
      const next = { ...prev }
      delete next[exId]
      return next
    })
  }

  const addExercise = async (name: string) => {
    const id = `added-${Date.now()}`
    const newEx: WorkoutExercise = {
      id,
      exercise_name: name,
      sets_target: 3,
      reps_min: 8,
      reps_max: 12,
      rest_seconds: 120,
      notes: null,
    }
    // Immediately add exercise with blank sets so the user sees it right away
    setExercises(prev => [...prev, newEx])
    setSets(prev => ({ ...prev, [id]: buildInitialSets(newEx.sets_target, 'working') }))
    setShowAddExercise(false)

    // Fetch history + targets for this exercise in the background
    setFetchingTargetsFor(prev => new Set(prev).add(name))
    try {
      const res = await fetch(`/api/exercise-targets?name=${encodeURIComponent(name)}&workoutId=${workoutId}`)
      if (res.ok) {
        const data: {
          targets: Record<number, { weight: number; repsMin: number; repsMax: number; consecutiveMax: number; consecutiveFail: number }>
          lastSession: Record<number, { weight: number; reps: number }>
        } = await res.json()

        if (data.targets) setDynamicTargets(prev => ({ ...prev, [name]: data.targets }))
        if (data.lastSession) setDynamicLastSession(prev => ({ ...prev, [name]: data.lastSession }))

        // Rebuild the full set list with warm-up sets once we have the working weight
        const resolvedTargets = Object.keys(data.targets).length > 0
          ? data.targets
          : (data.lastSession && Object.keys(data.lastSession).length > 0 ? computeFallbackTargets(newEx, data.lastSession) : {})

        setSets(prev => {
          // Only rebuild if no sets have been logged yet
          const alreadyLogged = (prev[id] ?? []).some(s => s.logged)
          if (alreadyLogged) return prev
          return { ...prev, [id]: buildSetsForExercise(newEx, resolvedTargets) }
        })
      }
    } catch {
      // Silently fail — blank sets are already shown
    } finally {
      setFetchingTargetsFor(prev => { const s = new Set(prev); s.delete(name); return s })
    }
  }

  const finishWorkout = useCallback(async () => {
    setFinishing(true)
    const durationMinutes = Math.round((Date.now() - startTime) / 60000)
    const loggedWorkingSets = Object.values(sets).flat().filter(s => s.logged && s.setType === 'working')
    const isCompleteSession = exercises.every(exercise => {
      const loggedForExercise = (sets[exercise.id] ?? []).filter(s => s.logged && s.setType === 'working')
      return loggedForExercise.length >= exercise.sets_target
    })

    if (loggedWorkingSets.length === 0) {
      alert('Log at least one working set before finishing the workout.')
      setFinishing(false)
      return
    }

    // Progression engine — update exercise_targets for next session
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('You must be logged in to finish a workout.')

      // Partial sessions still save, but they are not progression signals.
      if (isCompleteSession) {
      for (const exercise of exercises) {
        const exerciseSets = sets[exercise.id] ?? []
        // Only consider working sets — warm-up sets excluded
        const workingSets = exerciseSets.filter(s => s.logged && s.setType === 'working')
        if (workingSets.length < exercise.sets_target) continue

        const currentWeight = Number(workingSets[0].weight)
        if (!Number.isFinite(currentWeight)) continue
        if (!isBodyweightExercise(exercise.exercise_name) && currentWeight <= 0) continue
        if (isBodyweightExercise(exercise.exercise_name) && currentWeight < 0) continue

        // Read counter values from targets loaded at workout start
        const mergedTargets = suggestedTargets[exercise.exercise_name] ?? dynamicTargets[exercise.exercise_name]
        let consecMax  = mergedTargets?.[1]?.consecutiveMax  ?? 0
        let consecFail = mergedTargets?.[1]?.consecutiveFail ?? 0

        // Evaluate today's performance
        const allHitMax     = workingSets.every(s => Number(s.reps) >= exercise.reps_max)
        const set1FailedMin = Number(workingSets[0].reps) < exercise.reps_min

        if (allHitMax) {
          consecMax  += 1
          consecFail  = 0
        } else if (set1FailedMin) {
          consecFail += 1
          consecMax   = 0
        }
        // else: no change to either counter

        // "Keep same weight" override — user tapped button in coach card
        if (keepSameWeightFor.has(exercise.exercise_name)) {
          consecMax = 0  // prevent bump; consecFail unchanged
        }

        // Determine next session weight
        let nextWeight = currentWeight
        if (consecFail >= 3) {
          nextWeight = Math.round(currentWeight * DELOAD_FACTOR / 2.5) * 2.5
          consecFail = 0
          consecMax  = 0
        } else if (consecMax >= 2) {
          const increment = WEIGHT_INCREMENT[EXERCISE_TYPE[exercise.exercise_name] ?? 'isolation']
          nextWeight = currentWeight + increment
          consecMax  = 0
        }

        // Upsert all sets with explicit RPT back-offs
        const totalSets = exercise.sets_target
        for (let i = 0; i < totalSets; i++) {
          const setWeight = i === 0 ? nextWeight
            : i === 1 ? Math.round(nextWeight * 0.90 / 2.5) * 2.5
            :           Math.round(nextWeight * 0.80 / 2.5) * 2.5

          const { error: upsertErr } = await supabase.from('exercise_targets').upsert({
            user_id:                   user.id,
            exercise_name:             exercise.exercise_name,
            set_number:                i + 1,
            target_weight_kg:          setWeight,
            target_reps_min:           exercise.reps_min,
            target_reps_max:           exercise.reps_max,
            consecutive_max_sessions:  consecMax,
            consecutive_fail_sessions: consecFail,
            updated_at:                new Date().toISOString(),
          }, { onConflict: 'user_id,exercise_name,set_number' })

          if (upsertErr) throw upsertErr
        }
      }
      }
      const { error: completeError } = await supabase.from('workouts').update({
        completed_at: new Date().toISOString(),
        duration_minutes: durationMinutes,
      }).eq('id', workoutId)

      if (completeError) throw completeError

      try { localStorage.removeItem(`lazyfit_workout_draft_${workoutId}`) } catch {}
      router.push(`/train/summary/${workoutId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not finish workout. Try again.'
      alert(`Could not finish workout: ${message}`)
      setFinishing(false)
    }
  }, [workoutId, exercises, sets, startTime, supabase, router, suggestedTargets, dynamicTargets, keepSameWeightFor])

  const discardWorkout = async () => {
    await supabase.from('workout_sets').delete().eq('workout_id', workoutId)
    await supabase.from('workouts').delete().eq('id', workoutId)
    try { localStorage.removeItem(`lazyfit_workout_draft_${workoutId}`) } catch {}
    router.push('/train')
  }

  const allSetsFlat = Object.values(sets).flat()
  const totalLogged = allSetsFlat.filter(s => s.logged && s.setType === 'working').length
  const totalSets = allSetsFlat.filter(s => s.setType === 'working').length
  console.log('[workout] totalLogged:', totalLogged, 'totalSets:', totalSets)

  // ─── Suppress unused var warning for toggleSetType ────────────────────────
  void toggleSetType

  return (
    <>
      {restTimer.active && (
        <RestTimer
          seconds={restTimer.seconds}
          onDone={() => setRestTimer({ active: false, seconds: 120 })}
          onFinishWorkout={finishWorkout}
          finishing={finishing}
        />
      )}

      {showAddExercise && (
        <AddExerciseModal onAdd={addExercise} onClose={() => setShowAddExercise(false)} />
      )}

      {showHowToFor && (
        <HowToModal exerciseName={showHowToFor} onClose={() => setShowHowToFor(null)} />
      )}

      {/* Click-away backdrop for options menus */}
      {showOptionsFor && (
        <div className="fixed inset-0 z-20" onClick={() => setShowOptionsFor(null)} />
      )}

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#000', borderBottom: '1px solid #222', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px 8px' }}>
          <button
            onClick={() => router.push('/train')}
            style={{ background: 'none', border: 'none', color: '#b8b8b8', cursor: 'pointer', flexShrink: 0, padding: 0, fontFamily: 'inherit' }}
            aria-label="Back to train"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2, margin: 0 }}>
              {routineName ?? 'Workout'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {restTimer.seconds > 0 && (
              <button
                onClick={() => setRestTimer(r => ({ ...r, active: true }))}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid #888888', color: '#888', borderRadius: '8px', fontSize: '10px', fontFamily: 'inherit', letterSpacing: '0.08em', background: 'none', cursor: 'pointer' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                REST
              </button>
            )}
            <button
              onClick={finishWorkout}
              disabled={finishing}
              style={{ padding: '8px 20px', background: '#3ecf8e', color: '#000', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', borderRadius: '8px', border: 'none', cursor: finishing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: finishing ? 0.4 : 1 }}
            >
              {finishing ? 'SAVING...' : 'FINISH'}
            </button>
          </div>
        </div>
        {/* Progress row */}
        <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, height: '4px', background: '#2a2a2a', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#3ecf8e', borderRadius: '9999px', transition: 'width 500ms', width: totalSets > 0 ? `${(totalLogged / totalSets) * 100}%` : '0%' }} />
          </div>
          <p style={{ fontSize: '14px', color: '#888', flexShrink: 0, fontFamily: 'inherit', margin: 0 }}>
            {formatTime(elapsed)} · {totalLogged}/{totalSets} working sets
          </p>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px', paddingBottom: 'calc(160px + env(safe-area-inset-bottom, 0px))', overflowX: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
        {exercises.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ color: '#aaa', fontSize: '14px', margin: 0 }}>No exercises yet.</p>
            <p style={{ color: '#b8b8b8', fontSize: '12px', marginTop: '4px' }}>Tap &quot;+ Add Exercise&quot; below to start.</p>
          </div>
        )}

        {exercises.map(exercise => {
          const exSets = sets[exercise.id] ?? []
          const mergedSuggestedTargets = suggestedTargets[exercise.exercise_name] ?? dynamicTargets[exercise.exercise_name]
          const mergedLastSession = lastSession[exercise.exercise_name] ?? dynamicLastSession[exercise.exercise_name]
          const targets = mergedSuggestedTargets ?? (mergedLastSession && Object.keys(mergedLastSession).length > 0 ? computeFallbackTargets(exercise, mergedLastSession) : {})
          const prevSession = mergedLastSession
          const isBodyweight = isBodyweightExercise(exercise.exercise_name)

          // Coach card — only for PRIMARY_COMPOUNDS
          const showCoachCard = PRIMARY_COMPOUNDS.includes(exercise.exercise_name)

          // Badge + message derivation (computed here, used in JSX below)
          const prevSet1    = prevSession?.[1]
          const targetSet1  = targets?.[1]
          const targetWeight = targetSet1?.weight
          const prevWeight   = prevSet1?.weight
          const consecMax    = (targets?.[1] as { consecutiveMax?: number } | undefined)?.consecutiveMax  ?? 0
          const consecFail   = (targets?.[1] as { consecutiveFail?: number } | undefined)?.consecutiveFail ?? 0

          type CoachBadge = 'level_up' | 'reset' | 'first' | 'lock_in'
          let badge: CoachBadge = 'lock_in'
          if (!prevSet1)                                              badge = 'first'
          else if (targetWeight !== undefined && prevWeight !== undefined && targetWeight > prevWeight) badge = 'level_up'
          else if (targetWeight !== undefined && prevWeight !== undefined && targetWeight < prevWeight) badge = 'reset'
          else                                                        badge = 'lock_in'

          const badgeLabel =
            badge === 'first'    ? 'First Session' :
            badge === 'level_up' ? '↑ Level Up' :
            badge === 'reset'    ? '↓ Reset' :
                                   '→ Lock In'

          const badgeStyle: React.CSSProperties =
            badge === 'level_up'
              ? { background: 'rgba(62,207,142,0.1)', border: '1px solid rgba(62,207,142,0.3)', color: '#3ecf8e' }
              : badge === 'reset'
              ? { background: 'rgba(255,59,92,0.1)',  border: '1px solid rgba(255,59,92,0.25)',  color: '#ff3b5c' }
              : { background: '#2a1f00',              border: '1px solid rgba(255,170,0,0.3)',    color: '#FFAA00' }

          let coachMessage: string
          if (badge === 'first') {
            coachMessage = "Pick a weight you can control for all 3 sets — this baseline is everything."
          } else if (badge === 'level_up') {
            coachMessage = `Two sessions at ${prevWeight}kg. ${targetWeight}kg is loaded — you earned this.`
          } else if (badge === 'reset') {
            coachMessage = `Resetting to ${targetWeight}kg. One sharp session here, then back to business.`
          } else {
            if (consecFail >= 1) {
              coachMessage = "This weight is fighting back. Own it before you move on."
            } else if (consecMax >= 1) {
              coachMessage = `You hit ${prevWeight}kg last time. One more clean session and the weight goes up.`
            } else {
              coachMessage = "Hit all sets clean today and you'll unlock the next weight."
            }
          }

          return (
            <div key={exercise.id} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>

              {/* Exercise header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  <button
                    onClick={() => router.push(`/train/exercise/${encodeURIComponent(exercise.exercise_name)}`)}
                    style={{ fontSize: '14px', fontWeight: 700, color: '#fff', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {exercise.exercise_name}
                  </button>
                  <button
                    onClick={() => setShowHowToFor(exercise.exercise_name)}
                    style={{ fontSize: '13px', color: '#f0f0f0', fontWeight: 600, background: '#0d2118', border: '1px solid rgba(62,207,142,0.4)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  >
                    How to
                  </button>
                </div>
                <div style={{ position: 'relative', zIndex: 30, flexShrink: 0 }}>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setShowOptionsFor(showOptionsFor === exercise.id ? null : exercise.id)
                    }}
                    style={{ color: '#b8b8b8', cursor: 'pointer', background: 'none', border: 'none', padding: '4px', fontFamily: 'inherit' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>
                  {showOptionsFor === exercise.id && (
                    <div style={{ position: 'absolute', right: 0, top: '32px', width: '192px', background: '#111', border: '1px solid #222', borderRadius: '12px', overflow: 'hidden', zIndex: 30, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                      <button
                        onClick={() => {
                          setShowNotesFor(showNotesFor === exercise.id ? null : exercise.id)
                          setShowOptionsFor(null)
                        }}
                        style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#fff', background: 'none', border: 'none', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Notes
                      </button>
                      <button
                        onClick={() => {
                          router.push(`/train/exercise/${encodeURIComponent(exercise.exercise_name)}`)
                          setShowOptionsFor(null)
                        }}
                        style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#fff', background: 'none', border: 'none', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        View History
                      </button>
                      <button
                        onClick={() => { removeExercise(exercise.id); setShowOptionsFor(null) }}
                        style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#FF4040', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Remove from workout
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Coach card — loading state */}
              {isBodyweight && (
                <div style={{ margin: '-4px 16px 12px', fontSize: '12px', color: '#b8b8b8', lineHeight: 1.35, fontFamily: 'inherit' }}>
                  Added kg only. Use 0 for bodyweight reps.
                </div>
              )}

              {fetchingTargetsFor.has(exercise.exercise_name) && (
                <div style={{ margin: '0 16px 12px', background: '#0d1f17', border: '1px solid #1a3528', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="w-3.5 h-3.5 border border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span style={{ fontSize: '10px', color: '#3d6b3d', letterSpacing: '0.08em', fontFamily: 'inherit' }}>LOADING HISTORY...</span>
                </div>
              )}

              {/* Coach card — PRIMARY_COMPOUNDS only */}
              {!fetchingTargetsFor.has(exercise.exercise_name) && showCoachCard && (
                <div style={{ margin: '0 16px 12px', background: '#0d1a0f', border: '1px solid #1a3528', borderLeft: '3px solid #3ecf8e', borderRadius: '10px', padding: '10px 14px', fontFamily: 'inherit' }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#3ecf8e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      COACH — TODAY
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', ...badgeStyle }}>
                      {badgeLabel}
                    </span>
                  </div>
                  {/* Message */}
                  <p style={{ fontSize: '14px', color: '#e0e0e0', lineHeight: 1.5, margin: '0 0 8px' }}>
                    {coachMessage}
                  </p>
                  {/* Keep same weight — only for Level Up */}
                  {badge === 'level_up' && (
                    <button
                      onClick={() => setKeepSameWeightFor(prev => new Set([...prev, exercise.exercise_name]))}
                      disabled={keepSameWeightFor.has(exercise.exercise_name)}
                      style={{ background: '#141414', border: 'none', borderRadius: '5px', padding: '3px 8px', fontSize: '11px', color: keepSameWeightFor.has(exercise.exercise_name) ? '#3ecf8e' : '#b8b8b8', cursor: keepSameWeightFor.has(exercise.exercise_name) ? 'default' : 'pointer', fontFamily: 'inherit' }}
                    >
                      {keepSameWeightFor.has(exercise.exercise_name) ? '✓ Keeping same weight' : 'Keep same weight'}
                    </button>
                  )}
                </div>
              )}

              {/* Notes textarea */}
              {showNotesFor === exercise.id && (
                <div style={{ margin: '0 16px 12px' }}>
                  <textarea
                    value={exerciseNotes[exercise.id] ?? ''}
                    onChange={e => setExerciseNotes(prev => ({ ...prev, [exercise.id]: e.target.value }))}
                    placeholder="Notes for this exercise..."
                    rows={2}
                    style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#fff', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              {/* ── WARM-UP SECTION ─────────────────────────── */}
              {(() => {
                const warmupSets = exSets.map((s, i) => ({ s, i })).filter(({ s }) => s.setType === 'warmup')
                const allWarmupLogged = warmupSets.length > 0 && warmupSets.every(({ s }) => s.logged)
                const firstUnloggedWarmupIdx = warmupSets.findIndex(({ s }) => !s.logged)

                if (warmupSets.length === 0) {
                  if (PRIMARY_COMPOUNDS.includes(exercise.exercise_name) && !isBodyweight && !fetchingTargetsFor.has(exercise.exercise_name)) {
                    return (
                      <div style={{ padding: '0 16px 8px' }}>
                        <p style={{ fontSize: '13px', color: '#848484', fontStyle: 'italic', margin: 0 }}>
                          Complete this session to unlock warm-up weights.
                        </p>
                      </div>
                    )
                  }
                  return null
                }

                return (
                  <div style={{ padding: '0 16px 8px' }}>
                    {allWarmupLogged ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#1f1400', border: '1px solid rgba(255,170,0,0.3)', color: '#FFAA00', fontSize: '9px', letterSpacing: '0.08em', padding: '4px 10px', borderRadius: '9999px', fontFamily: 'inherit' }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          WARM-UP COMPLETE
                        </span>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#FFAA00', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          WARM UP
                          <div style={{ flex: 1, height: '1px', background: '#2a1f00' }} />
                        </div>
                        {/* Column headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: '20px 36px 1fr 68px 68px 44px', gap: '6px', paddingBottom: '6px' }}>
                          <span /><span />
                          <span style={{ fontSize: '12px', color: '#b8b8b8', letterSpacing: '0.8px', fontFamily: 'inherit' }}>—</span>
                          <span style={{ fontSize: '12px', color: '#b8b8b8', letterSpacing: '0.8px', textAlign: 'center', fontFamily: 'inherit' }}>KG</span>
                          <span style={{ fontSize: '12px', color: '#b8b8b8', letterSpacing: '0.8px', textAlign: 'center', fontFamily: 'inherit' }}>REPS</span>
                          <span />
                        </div>
                        {/* Warm-up rows */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {warmupSets.map(({ s: setData, i: idx }, warmupIdx) => {
                            const isDone = setData.logged
                            const isActive = !isDone && warmupIdx === firstUnloggedWarmupIdx
                            const error = setErrors[`${exercise.id}-${idx}`]
                            const rowStyle: CSSProperties = isActive
                              ? { background: '#1a1200', borderRadius: '9px', borderLeft: '3px solid #FFAA00', margin: '3px -12px 5px', padding: '8px 10px 8px 9px' }
                              : {}
                            const kgStyle: CSSProperties = isActive
                              ? { background: '#1a1200', border: '1px solid #FFAA00', borderRadius: '7px', padding: '8px 5px', fontSize: '18px', fontWeight: 700, color: '#FFAA00', WebkitTextFillColor: '#FFAA00', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none', opacity: 1 }
                              : { background: '#141414', border: '1px solid #2a1f00', borderRadius: '7px', padding: '8px 5px', fontSize: '18px', fontWeight: 700, color: '#b8b8b8', WebkitTextFillColor: '#b8b8b8', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none', opacity: 1 }
                            const repsStyle: CSSProperties = isActive
                              ? { background: '#1a1200', border: '1px solid #FFAA00', borderRadius: '7px', padding: '8px 5px', fontSize: '18px', fontWeight: 600, color: '#FFAA00', WebkitTextFillColor: '#FFAA00', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none', opacity: 1 }
                              : { background: '#141414', border: '1px solid #2a1f00', borderRadius: '7px', padding: '8px 5px', fontSize: '18px', fontWeight: 600, color: '#f0f0f0', WebkitTextFillColor: '#f0f0f0', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none', opacity: 1 }

                            return (
                              <React.Fragment key={idx}>
                              <div style={{ display: 'grid', gridTemplateColumns: '20px 36px 1fr 68px 68px 44px', gap: '6px', alignItems: 'center', minHeight: '52px', ...rowStyle }}>
                                {/* × delete */}
                                <button
                                  onClick={() => removeSet(exercise.id, idx)}
                                  style={{ background: 'none', border: 'none', color: '#888888', fontSize: '14px', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                                >
                                  ×
                                </button>
                                {/* Type badge */}
                                <div style={{ fontSize: '15px', fontWeight: 700, textAlign: 'center', borderRadius: '5px', padding: '4px 2px', color: '#f0f0f0', background: '#1a1200' }}>
                                  W{warmupIdx + 1}
                                </div>
                                {/* Last ghost */}
                                <span style={{ fontSize: '10px', color: '#3a2a00', fontFamily: 'inherit' }}>—</span>
                                {/* KG */}
                                {isDone ? (
                                  <div style={{ background: '#141414', border: '1px solid #2a1f00', borderRadius: '7px', padding: '8px 5px', fontSize: '18px', fontWeight: 700, color: '#b8b8b8', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                                    {setData.weight}
                                  </div>
                                ) : (
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    value={setData.weight}
                                    onChange={e => updateSet(exercise.id, idx, 'weight', e.target.value)}
                                    style={kgStyle}
                                  />
                                )}
                                {/* Reps */}
                                {isDone ? (
                                  <div style={{ background: '#141414', border: '1px solid #2a1f00', borderRadius: '7px', padding: '8px 5px', fontSize: '18px', fontWeight: 600, color: '#f0f0f0', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                                    {setData.reps}
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={setData.reps}
                                    onChange={e => updateSet(exercise.id, idx, 'reps', e.target.value)}
                                    style={repsStyle}
                                  />
                                )}
                                {/* Circle */}
                                {isDone ? (
                                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#FFAA00', border: '2px solid #FFAA00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3.5">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => logSet(exercise, idx)}
                                    style={isActive
                                      ? { width: '40px', height: '40px', borderRadius: '50%', background: 'none', border: '2.5px solid #FFAA00', cursor: 'pointer' }
                                      : { width: '40px', height: '40px', borderRadius: '50%', background: 'none', border: '2px solid #2a1f00', cursor: 'pointer' }
                                    }
                                    aria-label="Log warm-up set"
                                  />
                                )}
                              </div>
                              {error && (
                                <div style={{ margin: '0 44px 6px 62px', fontSize: '12px', color: '#ff7a8a', lineHeight: 1.35, fontFamily: 'inherit' }}>
                                  {error}
                                </div>
                              )}
                              </React.Fragment>
                            )
                          })}
                        </div>
                        {/* Add warm-up set */}
                        <button
                          onClick={() => addWarmupSet(exercise.id)}
                          style={{ marginTop: '8px', fontSize: '14px', color: '#b8b8b8', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.08em', fontFamily: 'inherit' }}
                        >
                          + ADD WARM-UP SET
                        </button>
                      </>
                    )}
                  </div>
                )
              })()}

              {/* ── WORKING SETS SECTION ─────────────────────── */}
              {(() => {
                const hasWarmups = exSets.some(s => s.setType === 'warmup')
                const workingSets = exSets.map((s, i) => ({ s, i })).filter(({ s }) => s.setType === 'working')
                const firstUnloggedWorkingIdx = workingSets.findIndex(({ s }) => !s.logged)

                return (
                  <>
                    {hasWarmups && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 16px 8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', letterSpacing: '0.08em', fontFamily: 'inherit' }}>WORKING SETS</span>
                        <div style={{ flex: 1, height: '1px', background: '#1a1a1a' }} />
                      </div>
                    )}
                    {/* Column headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '20px 36px 1fr 68px 68px 44px', gap: '6px', padding: '0 16px 6px' }}>
                      <span /><span />
                      <span style={{ fontSize: '13px', color: '#b8b8b8', letterSpacing: '0.8px', fontFamily: 'inherit' }}>LAST TIME</span>
                      <span style={{ fontSize: isBodyweight ? '10px' : '13px', color: '#b8b8b8', letterSpacing: '0.8px', textAlign: 'center', fontFamily: 'inherit', lineHeight: 1.1 }}>{isBodyweight ? 'ADDED KG' : 'KG'}</span>
                      <span style={{ fontSize: '13px', color: '#b8b8b8', letterSpacing: '0.8px', textAlign: 'center', fontFamily: 'inherit' }}>REPS</span>
                      <span />
                    </div>
                    {/* Working set rows */}
                    <div style={{ padding: '0 16px 4px', display: 'flex', flexDirection: 'column' }}>
                      {workingSets.map(({ s: setData, i: idx }, workingIdx) => {
                        const workingSetNum = workingIdx + 1
                        const setTarget = targets?.[workingSetNum]
                        const prevSet = prevSession?.[workingSetNum]
                        const weightPh = setTarget ? String(setTarget.weight) : ''
                        const repsPh = setTarget
                          ? `${setTarget.repsMin}–${setTarget.repsMax}`
                          : `${exercise.reps_min}–${exercise.reps_max}`
                        const isDone = setData.logged
                        const isActive = !isDone && workingIdx === firstUnloggedWorkingIdx
                        const isEditing = editingSet.has(`${exercise.id}-${idx}`)
                        const error = setErrors[`${exercise.id}-${idx}`]

                        const rowStyle: CSSProperties = isDone && !isEditing
                          ? { opacity: 0.35 }
                          : isActive
                            ? { background: '#0d1a12', borderRadius: '9px', borderLeft: '3px solid #3ecf8e', margin: '3px -12px 5px', padding: '8px 10px 8px 9px' }
                            : {}
                        const kgStyle: CSSProperties = isActive
                          ? { background: '#0d1f17', border: '1px solid #3ecf8e', borderRadius: '7px', padding: '8px 5px', fontSize: '20px', fontWeight: 700, color: '#f0f0f0', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none' }
                          : { background: '#141414', border: '1px solid #1e1e1e', borderRadius: '7px', padding: '8px 5px', fontSize: '20px', fontWeight: 700, color: '#888', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none' }
                        const repsStyle: CSSProperties = isActive
                          ? { background: '#3ecf8e', border: '1px solid #3ecf8e', borderRadius: '7px', padding: '8px 5px', fontSize: '16px', fontWeight: 600, color: '#000000', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none' }
                          : { background: '#141414', border: '1px solid #1e1e1e', borderRadius: '7px', padding: '8px 5px', fontSize: '16px', fontWeight: 600, color: '#b8b8b8', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none' }

                        return (
                          <React.Fragment key={idx}>
                          <div style={{ display: 'grid', gridTemplateColumns: '20px 36px 1fr 68px 68px 44px', gap: '6px', alignItems: 'center', minHeight: '56px', ...rowStyle }}>
                            {/* × delete */}
                            <button
                              onClick={() => removeSet(exercise.id, idx)}
                              style={{ background: 'none', border: 'none', color: '#888888', fontSize: '14px', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                            >
                              ×
                            </button>
                            {/* Type badge */}
                            <div style={{ fontSize: '15px', fontWeight: 700, textAlign: 'center', borderRadius: '5px', padding: '4px 2px', color: isActive ? '#3ecf8e' : '#b8b8b8', background: isActive ? '#0d2118' : '#1e1e1e', minWidth: '28px' }}>
                              {setData.isPR ? '🏆' : workingSetNum}
                            </div>
                            {/* Last session ghost */}
                            <span style={{ fontSize: '14px', color: '#b8b8b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                              {prevSet ? `${prevSet.weight} × ${prevSet.reps}` : '—'}
                            </span>
                            {/* KG */}
                            <input
                              type="number"
                              inputMode="decimal"
                              value={setData.weight}
                              onChange={e => updateSet(exercise.id, idx, 'weight', e.target.value)}
                              disabled={setData.logged && !isEditing}
                              placeholder={weightPh}
                              style={kgStyle}
                            />
                            {/* Reps */}
                            <input
                              type="text"
                              inputMode="numeric"
                              value={setData.reps}
                              onChange={e => updateSet(exercise.id, idx, 'reps', e.target.value)}
                              disabled={setData.logged && !isEditing}
                              placeholder={repsPh}
                              style={repsStyle}
                            />
                            {/* Circle */}
                            {isDone ? (
                              <button
                                onClick={() => {
                                  const key = `${exercise.id}-${idx}`
                                  if (editingSet.has(key)) {
                                    relogSet(exercise, idx)
                                  } else {
                                    setEditingSet(prev => { const next = new Set(prev); next.add(key); return next })
                                  }
                                }}
                                style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#3ecf8e', border: '2px solid #3ecf8e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                aria-label={isEditing ? 'Save set' : 'Edit set'}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3.5">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={() => logSet(exercise, idx)}
                                style={isActive
                                  ? { width: '40px', height: '40px', borderRadius: '50%', background: 'none', border: '2.5px solid #3ecf8e', cursor: 'pointer' }
                                  : { width: '40px', height: '40px', borderRadius: '50%', background: 'none', border: '2px solid #1e1e1e', cursor: 'pointer' }
                                }
                                aria-label="Log set"
                              />
                            )}
                          </div>
                          {/* Machine increment note — non-barbell only, small weight jump */}
                          {error && (
                            <div style={{ margin: '0 44px 6px 62px', fontSize: '12px', color: '#ff7a8a', lineHeight: 1.35, fontFamily: 'inherit' }}>
                              {error}
                            </div>
                          )}
                          {workingIdx === 0 && (() => {
                            const exType = EXERCISE_TYPE[exercise.exercise_name]
                            const isNonBarbell = exType === 'cable_machine' || exType === 'isolation'
                            const curW  = targets?.[1]?.weight ?? 0
                            const prevW = prevSession?.[1]?.weight ?? 0
                            const diff  = curW - prevW
                            return (isNonBarbell && diff > 0 && diff < 5) ? (
                              <p style={{ fontSize: '12px', color: '#848484', margin: '2px 0 4px 56px', fontFamily: 'inherit' }}>
                                Add smallest plate available
                              </p>
                            ) : null
                          })()}
                          </React.Fragment>
                        )
                      })}
                    </div>
                  </>
                )
              })()}

              {/* + ADD SET */}
              <button
                onClick={() => addSet(exercise.id)}
                style={{ width: '100%', padding: '10px', fontSize: '15px', fontWeight: 600, color: '#b8b8b8', letterSpacing: '0.08em', background: 'none', border: 'none', borderTop: '1px solid #1a1a1a', marginTop: '8px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                + ADD SET
              </button>
            </div>
          )
        })}

        {/* + ADD EXERCISE */}
        <button
          onClick={() => setShowAddExercise(true)}
          style={{ width: '100%', padding: '16px', border: '1px dashed #888888', borderRadius: '12px', fontSize: '15px', fontWeight: 600, color: '#b8b8b8', letterSpacing: '0.08em', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + ADD EXERCISE
        </button>

        {/* Finish Workout button — ghost */}
        <button
          onClick={finishWorkout}
          disabled={finishing}
          style={{ background: 'none', border: '1px solid #222', color: '#b8b8b8', borderRadius: '12px', padding: '14px', fontSize: '17px', fontWeight: 700, width: '100%', cursor: finishing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: finishing ? 0.4 : 1 }}
        >
          {finishing ? 'SAVING WORKOUT...' : 'FINISH WORKOUT'}
        </button>

        {/* Discard workout */}
        {showDiscardConfirm ? (
          <div style={{ border: '1px solid rgba(255,59,92,0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#f0f0f0' }}>Discard this workout? All logged sets will be deleted.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowDiscardConfirm(false)}
                style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid #333', borderRadius: '8px', color: '#b8b8b8', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                onClick={discardWorkout}
                style={{ flex: 1, padding: '10px', background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.4)', borderRadius: '8px', color: '#ff3b5c', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Yes, Discard
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDiscardConfirm(true)}
            style={{ background: 'none', border: 'none', color: '#484848', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0', display: 'block', margin: '0 auto' }}
          >
            Discard workout
          </button>
        )}
      </div>

      {/* Session bar — overlays BottomNav (zIndex 50 > BottomNav z-40) */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0d0d0d', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: '10px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', zIndex: 50, fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif', maxWidth: '100vw', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: '13px', color: '#b8b8b8' }}>Elapsed</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f0f0f0' }}>{formatTime(elapsed)}</span>
        </div>
        <div style={{ width: '1px', height: '22px', background: '#1a1a1a' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: '13px', color: '#b8b8b8' }}>Sets done</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#3ecf8e' }}>{totalLogged}</span>
        </div>
        <div style={{ width: '1px', height: '22px', background: '#1a1a1a' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: '13px', color: '#b8b8b8' }}>Remaining</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#f0f0f0' }}>{totalSets - totalLogged}</span>
        </div>
        <div style={{ width: '1px', height: '22px', background: '#1a1a1a' }} />
        <button style={{ background: '#1a1a1a', border: 'none', borderRadius: '8px', padding: '8px 14px', color: '#b8b8b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Pause
        </button>
      </div>
    </>
  )
}
