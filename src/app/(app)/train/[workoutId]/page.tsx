import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ActiveWorkoutClient from './ActiveWorkoutClient'

interface Props {
  params: Promise<{ workoutId: string }>
  searchParams: Promise<{ routineId?: string; empty?: string }>
}

export default async function ActiveWorkoutPage({ params, searchParams }: Props) {
  const { workoutId } = await params
  const { routineId, empty } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify workout belongs to user
  const { data: workout } = await supabase
    .from('workouts')
    .select('id, started_at, routine_id, routines(name)')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .single()

  if (!workout) redirect('/train')

  const resolvedRoutineId = routineId ?? workout.routine_id ?? null
  const routineName = (workout.routines as any)?.name ?? null

  // Fetch exercises — routine_exercises if routine, empty if start-empty
  type WorkoutExercise = {
    id: string
    exercise_name: string
    sets_target: number
    reps_min: number
    reps_max: number
    rest_seconds: number
    notes: string | null
  }

  let exercises: WorkoutExercise[] = []

  if (resolvedRoutineId && !empty) {
    const { data } = await supabase
      .from('routine_exercises')
      .select('id, exercise_name, sets_target, reps_min, reps_max, rest_seconds')
      .eq('routine_id', resolvedRoutineId)
      .order('exercise_order', { ascending: true })
    exercises = (data ?? []).map(e => ({ ...e, notes: null }))
  }

  // Fetch exercise_targets for suggestions
  const exerciseNames = exercises.map(e => e.exercise_name)
  const { data: targetRows } = await supabase
    .from('exercise_targets')
    .select('exercise_name, set_number, target_weight_kg, target_reps_min, target_reps_max, consecutive_max_sessions, consecutive_fail_sessions')
    .eq('user_id', user.id)
    .in('exercise_name', exerciseNames.length > 0 ? exerciseNames : ['__none__'])

  const suggestedTargets: Record<string, Record<number, { weight: number; repsMin: number; repsMax: number; consecutiveMax: number; consecutiveFail: number }>> = {}
  for (const row of targetRows ?? []) {
    if (!suggestedTargets[row.exercise_name]) suggestedTargets[row.exercise_name] = {}
    suggestedTargets[row.exercise_name][row.set_number] = {
      weight:          row.target_weight_kg,
      repsMin:         row.target_reps_min,
      repsMax:         row.target_reps_max,
      consecutiveMax:  row.consecutive_max_sessions,
      consecutiveFail: row.consecutive_fail_sessions,
    }
  }

  // Fetch last session per exercise across ALL of the user's workouts (not just same routine)
  // This ensures previous data shows even when the exercise was first done in an empty/different workout
  const lastSession: Record<string, Record<number, { weight: number; reps: number }>> = {}

  if (exerciseNames.length > 0) {
    // Get recent completed workouts for this user (last 50 is plenty)
    const { data: recentWorkouts } = await supabase
      .from('workouts')
      .select('id, completed_at')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .neq('id', workoutId)
      .order('completed_at', { ascending: false })
      .limit(50)

    const recentIds = (recentWorkouts ?? []).map(w => w.id)
    const completedAtById: Record<string, string> = {}
    for (const w of recentWorkouts ?? []) completedAtById[w.id] = w.completed_at as string

    if (recentIds.length > 0) {
      const { data: prevSets } = await supabase
        .from('workout_sets')
        .select('exercise_name, set_number, weight_kg, reps_completed, workout_id')
        .in('workout_id', recentIds)
        .in('exercise_name', exerciseNames)
        .or('set_type.is.null,set_type.eq.working')

      // For each exercise, find the most recent workout that had it
      const latestWorkoutPerExercise: Record<string, string> = {} // exercise_name → workout_id
      for (const s of prevSets ?? []) {
        const prev = latestWorkoutPerExercise[s.exercise_name]
        if (!prev || completedAtById[s.workout_id] > completedAtById[prev]) {
          latestWorkoutPerExercise[s.exercise_name] = s.workout_id
        }
      }

      // Collect sets from that most recent workout per exercise
      for (const s of prevSets ?? []) {
        if (latestWorkoutPerExercise[s.exercise_name] !== s.workout_id) continue
        if (!lastSession[s.exercise_name]) lastSession[s.exercise_name] = {}
        lastSession[s.exercise_name][s.set_number] = { weight: s.weight_kg, reps: s.reps_completed }
      }
    }
  }

  return (
    <ActiveWorkoutClient
      workoutId={workoutId}
      routineName={routineName}
      initialExercises={exercises}
      suggestedTargets={suggestedTargets}
      lastSession={lastSession}
    />
  )
}
