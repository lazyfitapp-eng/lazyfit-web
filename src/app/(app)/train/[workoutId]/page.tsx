import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ActiveWorkoutClient from './ActiveWorkoutClient'
import { getWorkoutCompletionStatus } from '@/lib/workoutCompletion'
import type { ExerciseTarget, SessionSet } from '@/lib/trainingProgression'

interface Props {
  params: Promise<{ workoutId: string }>
  searchParams: Promise<{ routineId?: string; empty?: string }>
}

type CurrentWorkoutSet = {
  exercise_name: string
  set_number: number
  weight_kg: number
  reps_completed: number
  set_type: string | null
}

type RecentWorkoutSet = CurrentWorkoutSet & {
  workout_id: string
}

function normalizeSetType(setType: string | null): 'warmup' | 'working' {
  return setType === 'warmup' ? 'warmup' : 'working'
}

function exerciseIdFromLoggedSetName(name: string) {
  return `logged-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'exercise'}`
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

  const { data: currentSetRows } = await supabase
    .from('workout_sets')
    .select('exercise_name, set_number, weight_kg, reps_completed, set_type')
    .eq('workout_id', workoutId)
    .order('set_number', { ascending: true })

  const currentWorkoutSets = (currentSetRows ?? []) as CurrentWorkoutSet[]

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

  const plannedExerciseNames = new Set(exercises.map(e => e.exercise_name))
  const loggedExerciseNames = [...new Set(currentWorkoutSets.map(set => set.exercise_name))]
  for (const exerciseName of loggedExerciseNames) {
    if (plannedExerciseNames.has(exerciseName)) continue

    const loggedWorkingSetNumbers = currentWorkoutSets
      .filter(set => set.exercise_name === exerciseName && normalizeSetType(set.set_type) === 'working')
      .map(set => set.set_number)
      .filter(setNumber => Number.isFinite(setNumber) && setNumber > 0)

    exercises.push({
      id: exerciseIdFromLoggedSetName(exerciseName),
      exercise_name: exerciseName,
      sets_target: Math.max(1, ...loggedWorkingSetNumbers),
      reps_min: 8,
      reps_max: 12,
      rest_seconds: 120,
      notes: null,
    })
    plannedExerciseNames.add(exerciseName)
  }

  // Fetch exercise_targets for suggestions
  const exerciseNames = exercises.map(e => e.exercise_name)
  const { data: targetRows } = await supabase
    .from('exercise_targets')
    .select('exercise_name, set_number, target_weight_kg, target_reps_min, target_reps_max, consecutive_max_sessions, consecutive_fail_sessions')
    .eq('user_id', user.id)
    .in('exercise_name', exerciseNames.length > 0 ? exerciseNames : ['__none__'])

  const suggestedTargets: Record<string, Record<number, ExerciseTarget>> = {}
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

  // Fetch last progression session per exercise from complete program workouts only.
  const lastSession: Record<string, Record<number, SessionSet>> = {}
  let lastCompletedWorkoutWasPartial = false

  if (exerciseNames.length > 0) {
    // Get recent completed workouts for this user (last 50 is plenty)
    const { data: recentWorkouts } = await supabase
      .from('workouts')
      .select('id, completed_at, routine_id')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .neq('id', workoutId)
      .order('completed_at', { ascending: false })
      .limit(50)

    const recentIds = (recentWorkouts ?? []).map(w => w.id)
    const completedAtById: Record<string, string> = {}
    for (const w of recentWorkouts ?? []) completedAtById[w.id] = w.completed_at as string

    if (recentIds.length > 0) {
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
      const mostRecentWorkout = (recentWorkouts ?? [])[0]

      for (const workout of recentWorkouts ?? []) {
        const plannedExercises = workout.routine_id ? (plannedExercisesByRoutine[workout.routine_id] ?? []) : []
        const workoutSets = setsByWorkout[workout.id] ?? []
        const status = getWorkoutCompletionStatus(plannedExercises, workoutSets)

        if (workout.id === mostRecentWorkout?.id) {
          lastCompletedWorkoutWasPartial = status.isPartial
        }

        if (workout.routine_id && status.isComplete) {
          completeProgramWorkoutIds.add(workout.id)
        }
      }

      const prevSets = recentSets.filter(set =>
        completeProgramWorkoutIds.has(set.workout_id) &&
        exerciseNames.includes(set.exercise_name) &&
        normalizeSetType(set.set_type) === 'working'
      )

      // For each exercise, find the most recent workout that had it
      const latestWorkoutPerExercise: Record<string, string> = {} // exercise_name -> workout_id
      for (const s of prevSets) {
        const prev = latestWorkoutPerExercise[s.exercise_name]
        if (!prev || completedAtById[s.workout_id] > completedAtById[prev]) {
          latestWorkoutPerExercise[s.exercise_name] = s.workout_id
        }
      }

      // Collect sets from that most recent workout per exercise
      for (const s of prevSets) {
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
      currentWorkoutSets={currentWorkoutSets}
      lastCompletedWorkoutWasPartial={lastCompletedWorkoutWasPartial}
    />
  )
}
