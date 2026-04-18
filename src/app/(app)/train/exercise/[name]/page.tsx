import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExerciseHistoryClient from './ExerciseHistoryClient'
import { getMuscle } from '@/lib/muscleMap'
import type { Session } from './ExerciseHistoryClient'

interface PageProps {
  params: Promise<{ name: string }>
}

function epley(w: number, r: number) {
  return w * (1 + r / 30)
}

export default async function ExerciseHistoryPage({ params }: PageProps) {
  const { name } = await params
  const exerciseName = decodeURIComponent(name)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { muscle, color: muscleColor } = getMuscle(exerciseName)

  // 1. All completed workouts for this user
  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, completed_at')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: true })

  if (!workouts || workouts.length === 0) {
    return (
      <ExerciseHistoryClient
        exerciseName={exerciseName}
        sessions={[]}
        allTimePR={null}
        muscle={muscle}
        muscleColor={muscleColor}
        prWorkoutId={null}
      />
    )
  }

  const workoutIds = workouts.map(w => w.id)
  const completedAtById: Record<string, string> = {}
  for (const w of workouts) {
    completedAtById[w.id] = w.completed_at as string
  }

  // 2. All sets for this exercise across those workouts
  const { data: sets } = await supabase
    .from('workout_sets')
    .select('workout_id, set_number, weight_kg, reps_completed, set_type')
    .in('workout_id', workoutIds)
    .ilike('exercise_name', exerciseName)
    .order('set_number', { ascending: true })

  if (!sets || sets.length === 0) {
    return (
      <ExerciseHistoryClient
        exerciseName={exerciseName}
        sessions={[]}
        allTimePR={null}
        muscle={muscle}
        muscleColor={muscleColor}
        prWorkoutId={null}
      />
    )
  }

  // 3. Group by workout_id
  const grouped: Record<string, Session> = {}
  for (const s of sets) {
    if (!completedAtById[s.workout_id]) continue
    if (!grouped[s.workout_id]) {
      grouped[s.workout_id] = {
        workoutId: s.workout_id,
        date: completedAtById[s.workout_id],
        sets: [],
        bestEst1RM: 0,
        bestSet: { weightKg: 0, reps: 0 },
        isPR: false,
      }
    }
    grouped[s.workout_id].sets.push({
      setNumber: s.set_number,
      weightKg: s.weight_kg,
      repsCompleted: s.reps_completed,
      setType: s.set_type,
    })
  }

  // 4. Compute bestEst1RM per session (working sets only)
  for (const session of Object.values(grouped)) {
    let best1RM = 0
    let bestSet = { weightKg: 0, reps: 0 }
    for (const s of session.sets) {
      if (s.setType === 'warmup') continue
      const rm = epley(s.weightKg, s.repsCompleted)
      if (rm > best1RM) {
        best1RM = rm
        bestSet = { weightKg: s.weightKg, reps: s.repsCompleted }
      }
    }
    session.bestEst1RM = best1RM
    session.bestSet = bestSet
  }

  // 5. Sort oldest → newest
  const sorted = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date))

  // 6. PR detection — mark the FIRST session that achieves the all-time max.
  //    Using a fresh map to avoid in-place mutation issues across RSC serialisation.
  const maxEst1RM = sorted.length > 0 ? Math.max(...sorted.map(s => s.bestEst1RM)) : 0
  let prMarked = false
  const sessions: Session[] = sorted.map(s => {
    const isThePR = !prMarked && maxEst1RM > 0 &&
      Math.abs(s.bestEst1RM - maxEst1RM) < 0.01
    if (isThePR) prMarked = true
    return { ...s, isPR: isThePR }
  })

  const prWorkoutId = sessions.find(s => s.isPR)?.workoutId ?? null

  const prSession = prWorkoutId
    ? sessions.find(s => s.workoutId === prWorkoutId) ?? null
    : sessions[sessions.length - 1] ?? null

  const allTimePR = prSession
    ? {
        est1RM: prSession.bestEst1RM,
        weightKg: prSession.bestSet.weightKg,
        reps: prSession.bestSet.reps,
        date: prSession.date,
      }
    : null

  return (
    <ExerciseHistoryClient
      exerciseName={exerciseName}
      sessions={sessions}
      allTimePR={allTimePR}
      muscle={muscle}
      muscleColor={muscleColor}
      prWorkoutId={prWorkoutId}
    />
  )
}
