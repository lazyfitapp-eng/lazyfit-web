'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeWarmupSets } from '@/lib/warmup'

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
        <button onClick={onClose} className="text-[#555] hover:text-white transition-colors">
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
            <span className="text-xs text-[#444] font-mono">Loading...</span>
          </div>
        )}
        {!loading && !data && (
          <p className="text-xs text-[#444] font-mono py-4">No instructions found for this exercise.</p>
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
                className="flex flex-col items-center justify-center gap-3 w-full py-8 rounded-lg bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#333] transition-colors"
              >
                <svg width="48" height="34" viewBox="0 0 48 34" fill="none">
                  <rect width="48" height="34" rx="8" fill="#FF0000"/>
                  <path d="M19 10L34 17L19 24V10Z" fill="white"/>
                </svg>
                <div className="text-center">
                  <p className="text-xs font-bold text-white font-mono">{exerciseName.toUpperCase()}</p>
                  <p className="text-[10px] text-[#555] font-mono mt-1">TAP TO WATCH FORM GUIDE</p>
                </div>
              </a>
            )}
            {data.targetMuscle && (
              <p className="text-[10px] text-[#555] font-mono">
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
  suggestedTargets: Record<string, Record<number, { weight: number; repsMin: number; repsMax: number }>>
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

  const allHitMax = Object.values(lastSess).every(s => s.reps >= exercise.reps_max)
  const compoundKeywords = ['bench', 'squat', 'deadlift', 'press', 'row', 'pull', 'chin', 'dip']
  const isCompound = compoundKeywords.some(k => exercise.exercise_name.toLowerCase().includes(k))
  const nextWeight = allHitMax ? topSet.weight + (isCompound ? 2.5 : 1.0) : topSet.weight

  const totalSets = exercise.sets_target
  const result: Record<number, { weight: number; repsMin: number; repsMax: number }> = {}
  for (let i = 0; i < totalSets; i++) {
    const setWeight = i === 0
      ? nextWeight
      : Math.round(nextWeight * Math.pow(0.9, i) / 2.5) * 2.5
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
  const warmups = workingSet1 ? computeWarmupSets(workingSet1.weight) : []

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
      weight: target?.weight ? String(target.weight) : '',
      reps: '',
      logged: false,
      isPR: false,
      setType: 'working',
    }
  })

  return [...warmupStates, ...workingStates]
}

// ─── Rest Timer ───────────────────────────────────────────────────────────────

function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
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
        className="absolute top-6 right-6 text-[#555] hover:text-white transition-colors"
        aria-label="Close rest timer"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="text-center px-8">
        <p className="text-[10px] tracking-widest text-[#666] mb-6 font-mono">REST</p>
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
            className="w-14 h-14 rounded-full border border-[#333] text-[#aaa] hover:border-[#666] hover:text-white transition-all font-mono text-sm font-bold"
          >
            −15
          </button>
          <button
            onClick={() => onDoneRef.current()}
            className="text-[10px] tracking-widest text-[#555] hover:text-white transition-colors font-mono"
          >
            SKIP
          </button>
          <button
            onClick={() => adjust(+15)}
            className="w-14 h-14 rounded-full border border-[#333] text-[#aaa] hover:border-[#666] hover:text-white transition-all font-mono text-sm font-bold"
          >
            +15
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Exercise Modal ───────────────────────────────────────────────────────

const COMMON_EXERCISES = [
  'Barbell Bench Press', 'Barbell Row', 'Barbell Squat', 'Deadlift', 'Romanian Deadlift',
  'Overhead Press', 'Pull-Up', 'Lat Pulldown', 'Incline Dumbbell Press', 'Dumbbell Row',
  'Dumbbell Shoulder Press', 'Face Pull', 'Lateral Raise', 'Cable Row', 'Leg Press',
  'Leg Curl', 'Leg Extension', 'Calf Raise', 'Hip Thrust', 'Bulgarian Split Squat',
  'Tricep Pushdown', 'Skull Crusher', 'Bicep Curl', 'Hammer Curl', 'Preacher Curl',
  'Cable Fly', 'Pec Deck', 'Incline Barbell Press', 'Chest Dip', 'Seated Cable Row',
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
        <button onClick={onClose} className="text-[#555] hover:text-white transition-colors">
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
          className="flex-1 bg-transparent text-white text-sm placeholder-[#444] focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-[#444] hover:text-white transition-colors">
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
          <p className="text-center text-[#444] text-sm py-12">No exercises found.</p>
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
      const resolvedTargets = suggestedTargets[ex.exercise_name] ??
        computeFallbackTargets(ex, lastSession[ex.exercise_name] ?? {})
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
  const [dynamicTargets, setDynamicTargets] = useState<Record<string, Record<number, { weight: number; repsMin: number; repsMax: number }>>>({})
  const [dynamicLastSession, setDynamicLastSession] = useState<Record<string, Record<number, { weight: number; reps: number }>>>({})
  const [fetchingTargetsFor, setFetchingTargetsFor] = useState<Set<string>>(new Set())

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(t)
  }, [startTime])

  const updateSet = (exId: string, idx: number, field: 'weight' | 'reps', value: string) => {
    setSets(prev => ({
      ...prev,
      [exId]: prev[exId].map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }))
  }

  const logSet = async (exercise: WorkoutExercise, setIdx: number) => {
    const exSets = sets[exercise.id]
    const setData = exSets[setIdx]
    const isWarmup = setData.setType === 'warmup'

    // Compute separate set_number for warmup vs working sets
    const dbSetNumber = isWarmup
      ? exSets.slice(0, setIdx + 1).filter(s => s.setType === 'warmup').length
      : exSets.slice(0, setIdx + 1).filter(s => s.setType === 'working').length

    // Resolve weight/reps from input or suggestion
    const mergedSuggestedTargets = suggestedTargets[exercise.exercise_name] ?? dynamicTargets[exercise.exercise_name]
    const setTarget = !isWarmup ? mergedSuggestedTargets?.[dbSetNumber] : undefined
    const weight = parseFloat(setData.weight) || (setTarget?.weight ?? 0)
    const reps = parseInt(setData.reps) || (isWarmup ? parseInt(setData.reps) || 1 : (setTarget?.repsMin ?? exercise.reps_min))

    const { error } = await supabase.from('workout_sets').insert({
      workout_id: workoutId,
      exercise_name: exercise.exercise_name,
      set_number: dbSetNumber,
      weight_kg: weight,
      reps_completed: reps,
      set_type: isWarmup ? 'warmup' : 'working',
    })

    if (error) { console.error('logSet error:', error.message, error.code, error.details); alert(`Failed to log set: ${error.message}`); return }

    // PR detection only on working sets
    const isPR = !isWarmup && (() => {
      const curr1RM = epley1RM(weight, reps)
      const prevBest = prevSessionBest1RM(
        lastSession[exercise.exercise_name] ?? dynamicLastSession[exercise.exercise_name] ?? {}
      )
      return prevBest > 0 && curr1RM > prevBest
    })()

    setSets(prev => ({
      ...prev,
      [exercise.id]: prev[exercise.id].map((s, i) =>
        i === setIdx ? { ...s, logged: true, weight: String(weight), reps: String(reps), isPR } : s
      ),
    }))

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

  const removeSet = (exId: string, idx: number) => {
    setSets(prev => ({
      ...prev,
      [exId]: prev[exId].filter((_, i) => i !== idx),
    }))
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
          targets: Record<number, { weight: number; repsMin: number; repsMax: number }>
          lastSession: Record<number, { weight: number; reps: number }>
        } = await res.json()

        if (data.targets) setDynamicTargets(prev => ({ ...prev, [name]: data.targets }))
        if (data.lastSession) setDynamicLastSession(prev => ({ ...prev, [name]: data.lastSession }))

        // Rebuild the full set list with warm-up sets once we have the working weight
        const resolvedTargets = Object.keys(data.targets).length > 0
          ? data.targets
          : computeFallbackTargets(newEx, data.lastSession ?? {})

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

    await supabase.from('workouts').update({
      completed_at: new Date().toISOString(),
      duration_minutes: durationMinutes,
    }).eq('id', workoutId)

    // Progression engine — update exercise_targets for next session
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      for (const exercise of exercises) {
        const exerciseSets = sets[exercise.id] ?? []
        // Only consider working sets for progression — warm-up sets are excluded
        const workingSets = exerciseSets.filter(s => s.logged && s.setType === 'working')
        if (workingSets.length === 0) continue

        const weight = parseFloat(workingSets[0].weight) || 0
        if (weight === 0) continue

        const allHitMax = workingSets.every(s => parseInt(s.reps) >= exercise.reps_max)

        let nextWeight = weight
        if (allHitMax) {
          const compoundKeywords = ['bench', 'squat', 'deadlift', 'press', 'row', 'pull', 'chin', 'dip']
          const isCompound = compoundKeywords.some(k => exercise.exercise_name.toLowerCase().includes(k))
          nextWeight = weight + (isCompound ? 2.5 : 1.0)
        }

        const totalSets = Math.max(workingSets.length, exercise.sets_target)
        for (let i = 0; i < totalSets; i++) {
          const setWeight = i === 0
            ? nextWeight
            : Math.round(nextWeight * Math.pow(0.9, i) / 2.5) * 2.5
          const { error: upsertErr } = await supabase.from('exercise_targets').upsert({
            user_id: user.id,
            exercise_name: exercise.exercise_name,
            set_number: i + 1,
            target_weight_kg: setWeight,
            target_reps_min: exercise.reps_min,
            target_reps_max: exercise.reps_max,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,exercise_name,set_number' })
          if (upsertErr) console.error('exercise_targets upsert failed:', upsertErr.message, upsertErr.code)
        }
      }
    }

    router.push(`/train/summary/${workoutId}`)
  }, [workoutId, exercises, sets, startTime, supabase, router])

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
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', flexShrink: 0, padding: 0, fontFamily: 'inherit' }}
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
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid #333', color: '#888', borderRadius: '8px', fontSize: '10px', fontFamily: 'inherit', letterSpacing: '0.08em', background: 'none', cursor: 'pointer' }}
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
          <p style={{ fontSize: '10px', color: '#888', flexShrink: 0, fontFamily: 'inherit', margin: 0 }}>
            {formatTime(elapsed)} · {totalLogged}/{totalSets} working sets
          </p>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px', paddingBottom: '160px', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
        {exercises.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ color: '#aaa', fontSize: '14px', margin: 0 }}>No exercises yet.</p>
            <p style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>Tap &quot;+ Add Exercise&quot; below to start.</p>
          </div>
        )}

        {exercises.map(exercise => {
          const exSets = sets[exercise.id] ?? []
          const mergedSuggestedTargets = suggestedTargets[exercise.exercise_name] ?? dynamicTargets[exercise.exercise_name]
          const mergedLastSession = lastSession[exercise.exercise_name] ?? dynamicLastSession[exercise.exercise_name]
          const targets = mergedSuggestedTargets ?? computeFallbackTargets(exercise, mergedLastSession ?? {})
          const prevSession = mergedLastSession

          // Coach card data
          const targetSet1 = targets[1]
          const prevSet1 = prevSession?.[1]

          type CoachStatus = 'up' | 'hold' | 'first' | null
          let coachStatus: CoachStatus = null
          let weightDelta = 0

          if (targetSet1) {
            if (!prevSet1) {
              coachStatus = 'first'
            } else {
              weightDelta = Math.round((targetSet1.weight - prevSet1.weight) * 10) / 10
              coachStatus = weightDelta > 0 ? 'up' : 'hold'
            }
          }

          const prevSummary = prevSession
            ? Object.entries(prevSession)
                .sort(([a], [b]) => Number(a) - Number(b))
                .slice(0, 4)
                .map(([, s]) => `${s.weight}×${s.reps}`)
                .join('  ·  ')
            : null

          const showCoachCard = !!(targetSet1 || prevSummary)

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
                    style={{ fontSize: '11px', color: '#3ecf8e', fontWeight: 600, background: '#0d2118', border: 'none', borderRadius: '5px', padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
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
                    style={{ color: '#444', cursor: 'pointer', background: 'none', border: 'none', padding: '4px', fontFamily: 'inherit' }}
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
              {fetchingTargetsFor.has(exercise.exercise_name) && (
                <div style={{ margin: '0 16px 12px', background: '#0d1f17', border: '1px solid #1a3528', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="w-3.5 h-3.5 border border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span style={{ fontSize: '10px', color: '#3d6b3d', letterSpacing: '0.08em', fontFamily: 'inherit' }}>LOADING HISTORY...</span>
                </div>
              )}

              {/* Coach card */}
              {!fetchingTargetsFor.has(exercise.exercise_name) && showCoachCard && (
                <div style={{ margin: '0 16px 12px', background: '#0d1f17', border: '1px solid #1a3528', borderRadius: '10px', padding: '10px 14px', fontFamily: 'inherit' }}>
                  {targetSet1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#3ecf8e', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        COACH — TODAY
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {coachStatus === 'up' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(62,207,142,0.1)', border: '1px solid rgba(62,207,142,0.3)', color: '#3ecf8e', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>
                            ↑ +{weightDelta}kg
                          </span>
                        )}
                        {coachStatus === 'hold' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#666', fontSize: '10px', padding: '2px 8px', borderRadius: '9999px' }}>
                            → Hold
                          </span>
                        )}
                        {coachStatus === 'first' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', background: '#2a1f00', border: '1px solid rgba(255,170,0,0.3)', color: '#FFAA00', fontSize: '10px', padding: '2px 8px', borderRadius: '9999px' }}>
                            First session
                          </span>
                        )}
                        {coachStatus === 'up' && (
                          <button style={{ background: '#141414', border: 'none', borderRadius: '5px', padding: '3px 8px', fontSize: '11px', color: '#484848', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Keep same
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {targetSet1 && (
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                      {Object.entries(targets)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .slice(0, 3)
                        .map(([setNumStr, t]) => {
                          const sn = Number(setNumStr)
                          return (
                            <div key={sn} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '9px', color: '#3a5040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Set {sn}</span>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: '#e0f5ed' }}>{t.weight}kg</span>
                              <span style={{ fontSize: '10px', color: '#4a7060' }}>× {t.repsMin}–{t.repsMax}</span>
                            </div>
                          )
                        })}
                      {Object.keys(targets).length > 3 && (
                        <span style={{ fontSize: '10px', color: '#3a5040', paddingBottom: '2px' }}>
                          +{Object.keys(targets).length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                  {targetSet1 && prevSummary && (
                    <hr style={{ border: 'none', borderTop: '1px solid #1a3528', margin: '8px 0' }} />
                  )}
                  {prevSummary && (
                    <div>
                      <span style={{ fontSize: '11px', color: '#3a5040' }}>Last session: </span>
                      <span style={{ fontSize: '11px', color: '#5aaa80' }}>{prevSummary}</span>
                    </div>
                  )}
                  {!targetSet1 && !prevSummary && (
                    <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>No history yet — enter a comfortable starting weight.</p>
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

                if (warmupSets.length === 0) return null

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
                        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#FFAA00', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          WARM UP
                          <div style={{ flex: 1, height: '1px', background: '#2a1f00' }} />
                        </div>
                        {/* Column headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: '20px 36px 1fr 68px 68px 44px', gap: '6px', paddingBottom: '6px' }}>
                          <span /><span />
                          <span style={{ fontSize: '9px', color: '#5a4000', letterSpacing: '0.8px', fontFamily: 'inherit' }}>—</span>
                          <span style={{ fontSize: '9px', color: '#5a4000', letterSpacing: '0.8px', textAlign: 'center', fontFamily: 'inherit' }}>KG</span>
                          <span style={{ fontSize: '9px', color: '#5a4000', letterSpacing: '0.8px', textAlign: 'center', fontFamily: 'inherit' }}>REPS</span>
                          <span />
                        </div>
                        {/* Warm-up rows */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {warmupSets.map(({ s: setData, i: idx }, warmupIdx) => {
                            const isDone = setData.logged
                            const isActive = !isDone && warmupIdx === firstUnloggedWarmupIdx
                            const rowStyle: CSSProperties = isDone
                              ? { opacity: 0.35 }
                              : isActive
                                ? { background: '#1a1200', borderRadius: '9px', borderLeft: '3px solid #FFAA00', margin: '3px -12px 5px', padding: '8px 10px 8px 9px' }
                                : {}
                            const kgStyle: CSSProperties = isActive
                              ? { background: '#1a1200', border: '1px solid #FFAA00', borderRadius: '7px', padding: '8px 5px', fontSize: '14px', fontWeight: 600, color: '#FFAA00', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none' }
                              : { background: '#141414', border: '1px solid #2a1f00', borderRadius: '7px', padding: '8px 5px', fontSize: '14px', fontWeight: 600, color: '#888', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none' }
                            const repsStyle: CSSProperties = isActive
                              ? { background: '#1a1200', border: '1px solid #FFAA00', borderRadius: '7px', padding: '8px 5px', fontSize: '11px', fontWeight: 600, color: '#FFAA00', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none' }
                              : { background: '#141414', border: '1px solid #2a1f00', borderRadius: '7px', padding: '8px 5px', fontSize: '11px', fontWeight: 600, color: '#5a4000', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none' }

                            return (
                              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '20px 36px 1fr 68px 68px 44px', gap: '6px', alignItems: 'center', ...rowStyle }}>
                                {/* × delete */}
                                <button
                                  onClick={() => removeSet(exercise.id, idx)}
                                  style={{ background: 'none', border: 'none', color: '#2a2a2a', fontSize: '14px', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                                >
                                  ×
                                </button>
                                {/* Type badge */}
                                <div style={{ fontSize: '10px', fontWeight: 700, textAlign: 'center', borderRadius: '5px', padding: '4px 2px', color: '#FFAA00', background: '#1a1200' }}>
                                  W{warmupIdx + 1}
                                </div>
                                {/* Last ghost */}
                                <span style={{ fontSize: '10px', color: '#3a2a00', fontFamily: 'inherit' }}>—</span>
                                {/* KG */}
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  value={setData.weight}
                                  onChange={e => updateSet(exercise.id, idx, 'weight', e.target.value)}
                                  disabled={setData.logged}
                                  style={kgStyle}
                                />
                                {/* Reps */}
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={setData.reps}
                                  onChange={e => updateSet(exercise.id, idx, 'reps', e.target.value)}
                                  disabled={setData.logged}
                                  style={repsStyle}
                                />
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
                            )
                          })}
                        </div>
                        {/* Add warm-up set */}
                        <button
                          onClick={() => addWarmupSet(exercise.id)}
                          style={{ marginTop: '8px', fontSize: '9px', color: '#3a2a00', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.08em', fontFamily: 'inherit' }}
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
                        <span style={{ fontSize: '9px', color: '#484848', letterSpacing: '0.08em', fontFamily: 'inherit' }}>WORKING SETS</span>
                        <div style={{ flex: 1, height: '1px', background: '#1a1a1a' }} />
                      </div>
                    )}
                    {/* Column headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '20px 36px 1fr 68px 68px 44px', gap: '6px', padding: '0 16px 6px' }}>
                      <span /><span />
                      <span style={{ fontSize: '9px', color: '#484848', letterSpacing: '0.8px', fontFamily: 'inherit' }}>LAST TIME</span>
                      <span style={{ fontSize: '9px', color: '#484848', letterSpacing: '0.8px', textAlign: 'center', fontFamily: 'inherit' }}>KG</span>
                      <span style={{ fontSize: '9px', color: '#484848', letterSpacing: '0.8px', textAlign: 'center', fontFamily: 'inherit' }}>REPS</span>
                      <span />
                    </div>
                    {/* Working set rows */}
                    <div style={{ padding: '0 16px 4px', display: 'flex', flexDirection: 'column' }}>
                      {workingSets.map(({ s: setData, i: idx }, workingIdx) => {
                        const workingSetNum = workingIdx + 1
                        const setTarget = targets?.[workingSetNum]
                        const prevSet = prevSession?.[workingSetNum]
                        const weightPh = setTarget?.weight ? String(setTarget.weight) : ''
                        const repsPh = setTarget
                          ? `${setTarget.repsMin}–${setTarget.repsMax}`
                          : `${exercise.reps_min}–${exercise.reps_max}`
                        const isDone = setData.logged
                        const isActive = !isDone && workingIdx === firstUnloggedWorkingIdx

                        const rowStyle: CSSProperties = isDone
                          ? { opacity: 0.35 }
                          : isActive
                            ? { background: '#0d1a12', borderRadius: '9px', borderLeft: '3px solid #3ecf8e', margin: '3px -12px 5px', padding: '8px 10px 8px 9px' }
                            : {}
                        const kgStyle: CSSProperties = isActive
                          ? { background: '#0d1f17', border: '1px solid #3ecf8e', borderRadius: '7px', padding: '8px 5px', fontSize: '14px', fontWeight: 600, color: '#f0f0f0', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none' }
                          : { background: '#141414', border: '1px solid #1e1e1e', borderRadius: '7px', padding: '8px 5px', fontSize: '14px', fontWeight: 600, color: '#888', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none' }
                        const repsStyle: CSSProperties = isActive
                          ? { background: '#0d1f17', border: '1px solid #1a3528', borderRadius: '7px', padding: '8px 5px', fontSize: '11px', fontWeight: 600, color: '#3ecf8e', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none' }
                          : { background: '#141414', border: '1px solid #1e1e1e', borderRadius: '7px', padding: '8px 5px', fontSize: '11px', fontWeight: 600, color: '#444', textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none' }

                        return (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '20px 36px 1fr 68px 68px 44px', gap: '6px', alignItems: 'center', ...rowStyle }}>
                            {/* × delete */}
                            <button
                              onClick={() => removeSet(exercise.id, idx)}
                              style={{ background: 'none', border: 'none', color: '#2a2a2a', fontSize: '14px', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                            >
                              ×
                            </button>
                            {/* Type badge */}
                            <div style={{ fontSize: '10px', fontWeight: 700, textAlign: 'center', borderRadius: '5px', padding: '4px 2px', color: isActive ? '#3ecf8e' : '#555', background: isActive ? '#0d2118' : '#1e1e1e', minWidth: '28px' }}>
                              {setData.isPR ? '🏆' : workingSetNum}
                            </div>
                            {/* Last session ghost */}
                            <span style={{ fontSize: '10px', color: '#484848', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                              {prevSet ? `${prevSet.weight} × ${prevSet.reps}` : '—'}
                            </span>
                            {/* KG */}
                            <input
                              type="number"
                              inputMode="decimal"
                              value={setData.weight}
                              onChange={e => updateSet(exercise.id, idx, 'weight', e.target.value)}
                              disabled={setData.logged}
                              placeholder={weightPh}
                              style={kgStyle}
                            />
                            {/* Reps */}
                            <input
                              type="text"
                              inputMode="numeric"
                              value={setData.reps}
                              onChange={e => updateSet(exercise.id, idx, 'reps', e.target.value)}
                              disabled={setData.logged}
                              placeholder={repsPh}
                              style={repsStyle}
                            />
                            {/* Circle */}
                            {isDone ? (
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#3ecf8e', border: '2px solid #3ecf8e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3.5">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
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
                        )
                      })}
                    </div>
                  </>
                )
              })()}

              {/* + ADD SET */}
              <button
                onClick={() => addSet(exercise.id)}
                style={{ width: '100%', padding: '10px', fontSize: '9px', color: '#484848', letterSpacing: '0.08em', background: 'none', border: 'none', borderTop: '1px solid #1a1a1a', marginTop: '8px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                + ADD SET
              </button>
            </div>
          )
        })}

        {/* + ADD EXERCISE */}
        <button
          onClick={() => setShowAddExercise(true)}
          style={{ width: '100%', padding: '16px', border: '1px dashed #333', borderRadius: '12px', fontSize: '10px', color: '#484848', letterSpacing: '0.08em', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + ADD EXERCISE
        </button>

        {/* Finish Workout button — ghost */}
        <button
          onClick={finishWorkout}
          disabled={finishing}
          style={{ background: 'none', border: '1px solid #222', color: '#484848', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 600, width: '100%', cursor: finishing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: finishing ? 0.4 : 1 }}
        >
          {finishing ? 'SAVING WORKOUT...' : 'FINISH WORKOUT'}
        </button>
      </div>

      {/* Session bar — overlays BottomNav (zIndex 50 > BottomNav z-40) */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0d0d0d', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', paddingLeft: '20px', paddingRight: '20px', paddingBottom: 'env(safe-area-inset-bottom, 20px)', zIndex: 50, fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: '11px', color: '#484848' }}>Elapsed</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f0f0f0' }}>{formatTime(elapsed)}</span>
        </div>
        <div style={{ width: '1px', height: '22px', background: '#1a1a1a' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: '10px', color: '#484848' }}>Sets done</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#3ecf8e' }}>{totalLogged}</span>
        </div>
        <div style={{ width: '1px', height: '22px', background: '#1a1a1a' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: '10px', color: '#484848' }}>Remaining</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#f0f0f0' }}>{totalSets - totalLogged}</span>
        </div>
        <div style={{ width: '1px', height: '22px', background: '#1a1a1a' }} />
        <button style={{ background: '#1a1a1a', border: 'none', borderRadius: '8px', padding: '8px 14px', color: '#484848', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Pause
        </button>
      </div>
    </>
  )
}
