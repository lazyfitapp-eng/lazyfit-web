import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkoutCompletionStatus } from '@/lib/workoutCompletion'
import type { ExerciseTarget, SessionSet } from '@/lib/trainingProgression'

type RecentWorkoutSet = {
  workout_id: string
  exercise_name: string
  set_number: number
  weight_kg: number
  reps_completed: number
  set_type: string | null
}

function normalizeSetType(setType: string | null): 'warmup' | 'working' {
  return setType === 'warmup' ? 'warmup' : 'working'
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const name = req.nextUrl.searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  const workoutId = req.nextUrl.searchParams.get('workoutId') ?? null

  // Query 1: exercise_targets for this user + exercise
  const { data: targetRows } = await supabase
    .from('exercise_targets')
    .select('set_number, target_weight_kg, target_reps_min, target_reps_max, consecutive_max_sessions, consecutive_fail_sessions')
    .eq('user_id', user.id)
    .eq('exercise_name', name)

  const targets: Record<number, ExerciseTarget> = {}
  for (const row of targetRows ?? []) {
    targets[row.set_number] = {
      weight:          row.target_weight_kg,
      repsMin:         row.target_reps_min,
      repsMax:         row.target_reps_max,
      consecutiveMax:  row.consecutive_max_sessions,
      consecutiveFail: row.consecutive_fail_sessions,
    }
  }

  // Query 2: last 50 completed workouts (excluding current)
  let recentQuery = supabase
    .from('workouts')
    .select('id, completed_at, routine_id')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(50)

  if (workoutId) recentQuery = recentQuery.neq('id', workoutId)

  const { data: recentWorkouts } = await recentQuery

  const lastSession: Record<number, SessionSet> = {}

  if ((recentWorkouts ?? []).length > 0) {
    const recentIds = recentWorkouts!.map(w => w.id)
    const completedAtById: Record<string, string> = {}
    for (const w of recentWorkouts!) completedAtById[w.id] = w.completed_at as string

    // Query 3: all sets across recent workouts so partial program sessions can be excluded.
    const { data: recentSetRows } = await supabase
      .from('workout_sets')
      .select('workout_id, exercise_name, set_number, weight_kg, reps_completed, set_type')
      .in('workout_id', recentIds)

    const recentSets = (recentSetRows ?? []) as RecentWorkoutSet[]
    const routineIds = [
      ...new Set((recentWorkouts ?? []).map(w => w.routine_id).filter((id): id is string => Boolean(id))),
    ]
    let plannedExercisesByRoutine: Record<string, { exercise_name: string; sets_target: number }[]> = {}

    if (routineIds.length > 0) {
      const { data: plannedExercises } = await supabase
        .from('routine_exercises')
        .select('routine_id, exercise_name, sets_target')
        .in('routine_id', routineIds)

      plannedExercisesByRoutine = (plannedExercises ?? []).reduce((acc, exercise) => {
        acc[exercise.routine_id] = [...(acc[exercise.routine_id] ?? []), {
          exercise_name: exercise.exercise_name,
          sets_target: exercise.sets_target,
        }]
        return acc
      }, {} as Record<string, { exercise_name: string; sets_target: number }[]>)
    }

    const setsByWorkout = recentSets.reduce((acc, set) => {
      acc[set.workout_id] = [...(acc[set.workout_id] ?? []), set]
      return acc
    }, {} as Record<string, RecentWorkoutSet[]>)

    const completeProgramWorkoutIds = new Set<string>()
    for (const workout of recentWorkouts ?? []) {
      const plannedExercises = workout.routine_id ? (plannedExercisesByRoutine[workout.routine_id] ?? []) : []
      const workoutSets = setsByWorkout[workout.id] ?? []
      const status = getWorkoutCompletionStatus(plannedExercises, workoutSets)
      if (workout.routine_id && status.isComplete) {
        completeProgramWorkoutIds.add(workout.id)
      }
    }

    const prevSets = recentSets.filter(set =>
      completeProgramWorkoutIds.has(set.workout_id) &&
      set.exercise_name === name &&
      normalizeSetType(set.set_type) === 'working'
    )

    // Find the most recent workout that contained this exercise
    let latestWorkoutId: string | null = null
    for (const s of prevSets ?? []) {
      if (
        !latestWorkoutId ||
        completedAtById[s.workout_id] > completedAtById[latestWorkoutId]
      ) {
        latestWorkoutId = s.workout_id
      }
    }

    // Collect sets from that workout
    if (latestWorkoutId) {
      for (const s of prevSets ?? []) {
        if (s.workout_id !== latestWorkoutId) continue
        lastSession[s.set_number] = { weight: s.weight_kg, reps: s.reps_completed }
      }
    }
  }

  return NextResponse.json({ targets, lastSession })
}
