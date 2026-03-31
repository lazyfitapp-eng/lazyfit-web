'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Exercise {
  id: string
  exercise_name: string
  sets_target: number
  reps_min: number
  reps_max: number
  rest_seconds: number
  notes: string | null
  progression_type: string
}

interface SuggestedTargets {
  [exerciseName: string]: {
    [setNumber: number]: { weight: number; repsMin: number; repsMax: number }
  }
}

interface SetState {
  weight: string
  reps: string
  logged: boolean
  suggested: boolean // is this value from the engine?
}

function buildInitialSets(exercise: Exercise, targets: SuggestedTargets): SetState[] {
  return Array.from({ length: exercise.sets_target }, (_, i) => {
    const setNum = i + 1
    const target = targets[exercise.exercise_name]?.[setNum]
    if (target && target.weight > 0) {
      return {
        weight: String(target.weight),
        reps: String(target.repsMin),
        logged: false,
        suggested: true,
      }
    }
    return { weight: '', reps: String(exercise.reps_min), logged: false, suggested: false }
  })
}

// Rest timer component
function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    if (remaining <= 0) { onDone(); return }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining, onDone])

  const pct = ((seconds - remaining) / seconds) * 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="text-center">
        <p className="text-xs tracking-widest text-muted-foreground mb-4">REST</p>
        <p className="text-7xl font-bold text-primary font-mono" style={{ textShadow: '0 0 30px #00FF41' }}>
          {remaining}
        </p>
        <div className="mt-6 w-48 h-1 bg-[#222] rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <button
          onClick={onDone}
          className="mt-8 text-xs tracking-widest text-muted-foreground hover:text-white transition-colors"
        >
          SKIP REST
        </button>
      </div>
    </div>
  )
}

interface Props {
  workoutId: string
  exercises: Exercise[]
  suggestedTargets: SuggestedTargets
  goal: string
  userWeight: number
}

export default function ActiveWorkoutClient({ workoutId, exercises, suggestedTargets, goal, userWeight }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [sets, setSets] = useState<Record<string, SetState[]>>(() =>
    Object.fromEntries(exercises.map(ex => [ex.id, buildInitialSets(ex, suggestedTargets)]))
  )
  const [restTimer, setRestTimer] = useState<{ active: boolean; seconds: number }>({ active: false, seconds: 0 })
  const [finishing, setFinishing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [startTime] = useState(Date.now())

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(t)
  }, [startTime])

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const updateSet = (exerciseId: string, setIdx: number, field: 'weight' | 'reps', value: string) => {
    setSets(prev => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((s, i) =>
        i === setIdx ? { ...s, [field]: value, suggested: false } : s
      ),
    }))
  }

  const logSet = async (exercise: Exercise, setIdx: number) => {
    const setData = sets[exercise.id][setIdx]
    const weight = parseFloat(setData.weight) || 0
    const reps = parseInt(setData.reps) || 0

    const { error } = await supabase.from('workout_sets').insert({
      workout_id: workoutId,
      exercise_name: exercise.exercise_name,
      set_number: setIdx + 1,
      weight_kg: weight,
      reps_completed: reps,
      set_type: setIdx === 0 ? 'top' : 'back_off',
    })

    if (error) { console.error('logSet error:', error); return }

    setSets(prev => ({
      ...prev,
      [exercise.id]: prev[exercise.id].map((s, i) =>
        i === setIdx ? { ...s, logged: true } : s
      ),
    }))

    // Start rest timer
    setRestTimer({ active: true, seconds: exercise.rest_seconds || 120 })
  }

  const finishWorkout = useCallback(async () => {
    setFinishing(true)
    const durationMinutes = Math.round((Date.now() - startTime) / 60000)

    await supabase.from('workouts').update({
      completed_at: new Date().toISOString(),
      duration_minutes: durationMinutes,
    }).eq('id', workoutId)

    // Run progression engine for each exercise
    for (const exercise of exercises) {
      const exerciseSets = sets[exercise.id]
      const loggedSets = exerciseSets.filter(s => s.logged)
      if (loggedSets.length === 0) continue

      const topSet = loggedSets[0]
      const weight = parseFloat(topSet.weight) || 0
      const reps = parseInt(topSet.reps) || 0

      if (weight === 0) continue

      // Simple progression: if hit top of rep range on all sets → increase weight
      const allHitMax = loggedSets.every(s => parseInt(s.reps) >= exercise.reps_max)
      const allHitMin = loggedSets.every(s => parseInt(s.reps) >= exercise.reps_min)

      let nextWeight = weight
      let nextRepsMin = exercise.reps_min
      let nextRepsMax = exercise.reps_max

      if (allHitMax) {
        // Increase weight next session — compound 2.5kg, isolation 1kg
        const compoundKeywords = ['bench', 'squat', 'deadlift', 'press', 'row', 'pull', 'chin']
        const isCompound = compoundKeywords.some(k => exercise.exercise_name.toLowerCase().includes(k))
        nextWeight = weight + (isCompound ? 2.5 : 1.0)
        nextRepsMin = exercise.reps_min
        nextRepsMax = exercise.reps_max
      } else if (!allHitMin) {
        // Missed reps — hold weight
        nextWeight = weight
      }

      // Upsert targets for each set (RPT style — back-off sets calculated from top set)
      for (let i = 0; i < exercise.sets_target; i++) {
        const setWeight = i === 0 ? nextWeight : Math.round(nextWeight * Math.pow(0.9, i) / 2.5) * 2.5
        await supabase.from('exercise_targets').upsert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          exercise_name: exercise.exercise_name,
          set_number: i + 1,
          target_weight_kg: setWeight,
          target_reps_min: nextRepsMin,
          target_reps_max: nextRepsMax,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,exercise_name,set_number' })
      }
    }

    router.push('/app/train')
  }, [workoutId, exercises, sets, startTime, supabase, router])

  const totalLogged = Object.values(sets).flat().filter(s => s.logged).length
  const totalSets = Object.values(sets).flat().length

  return (
    <>
      {restTimer.active && (
        <RestTimer
          seconds={restTimer.seconds}
          onDone={() => setRestTimer({ active: false, seconds: 0 })}
        />
      )}

      <div className="space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between sticky top-14 bg-black/95 py-3 -mx-4 px-4 border-b border-[#111] z-10">
          <div>
            <p className="text-xs tracking-widest text-primary font-mono">{formatElapsed(elapsed)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{totalLogged}/{totalSets} sets logged</p>
          </div>
          <button
            onClick={finishWorkout}
            disabled={finishing}
            className="px-4 py-2 border border-primary text-primary text-xs font-bold tracking-widest rounded hover:bg-primary hover:text-black transition-all disabled:opacity-40"
          >
            {finishing ? 'SAVING...' : 'FINISH'}
          </button>
        </div>

        {/* Exercises */}
        {exercises.map((exercise) => (
          <div key={exercise.id} className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-4">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-white tracking-widest">{exercise.exercise_name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {exercise.sets_target} sets · {exercise.reps_min}–{exercise.reps_max} reps · {exercise.rest_seconds}s rest
              </p>
              {exercise.notes && (
                <p className="text-xs text-[#555] mt-1 italic">{exercise.notes}</p>
              )}
            </div>

            {/* Set rows */}
            <div className="space-y-2">
              {/* Column headers */}
              <div className="grid grid-cols-[32px_1fr_1fr_80px] gap-2 text-xs text-muted-foreground tracking-widest pb-1">
                <span>SET</span>
                <span>KG</span>
                <span>REPS</span>
                <span></span>
              </div>

              {sets[exercise.id]?.map((setData, idx) => (
                <div key={idx} className={`grid grid-cols-[32px_1fr_1fr_80px] gap-2 items-center ${setData.logged ? 'opacity-50' : ''}`}>
                  <span className="text-xs text-muted-foreground font-mono">{idx + 1}</span>

                  {/* Weight input */}
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={setData.weight}
                      onChange={e => updateSet(exercise.id, idx, 'weight', e.target.value)}
                      disabled={setData.logged}
                      placeholder="0"
                      className={`
                        w-full bg-[#111] border rounded px-3 py-2 text-sm font-mono text-white
                        focus:outline-none focus:border-primary transition-colors
                        ${setData.suggested ? 'border-primary/40 text-primary' : 'border-[#333]'}
                        ${setData.logged ? 'cursor-not-allowed' : ''}
                      `}
                    />
                    {setData.suggested && !setData.logged && (
                      <span className="absolute -top-2 right-1 text-[9px] text-primary tracking-widest">SUGGESTED</span>
                    )}
                  </div>

                  {/* Reps input */}
                  <input
                    type="number"
                    inputMode="numeric"
                    value={setData.reps}
                    onChange={e => updateSet(exercise.id, idx, 'reps', e.target.value)}
                    disabled={setData.logged}
                    placeholder="0"
                    className={`
                      w-full bg-[#111] border rounded px-3 py-2 text-sm font-mono text-white
                      focus:outline-none focus:border-primary transition-colors
                      ${setData.suggested ? 'border-primary/40' : 'border-[#333]'}
                      ${setData.logged ? 'cursor-not-allowed opacity-50' : ''}
                    `}
                  />

                  {/* Log button */}
                  {setData.logged ? (
                    <div className="flex items-center justify-center text-primary text-sm">✓</div>
                  ) : (
                    <button
                      onClick={() => logSet(exercise, idx)}
                      className="py-2 bg-primary/10 border border-primary/30 text-primary text-xs font-bold tracking-widest rounded hover:bg-primary hover:text-black transition-all"
                    >
                      LOG
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Finish button (bottom) */}
        <button
          onClick={finishWorkout}
          disabled={finishing}
          className="w-full py-4 border border-primary text-primary font-bold tracking-widest rounded hover:bg-primary hover:text-black transition-all disabled:opacity-40"
        >
          {finishing ? 'SAVING WORKOUT...' : 'FINISH WORKOUT'}
        </button>
      </div>
    </>
  )
}
