import { createClient } from '@/lib/supabase/server'
import { DEFAULT_ROUTINE_DELETE_GUARD_TEMPLATES, THREE_DAY_TEMPLATE } from '@/lib/createDefaultRoutines'
import { redirect } from 'next/navigation'
import TrainClient from './TrainClient'
import { getWorkoutCompletionStatus } from '@/lib/workoutCompletion'

function isDefaultRoutine(name: string, exerciseNames: string[]) {
  const exerciseSet = new Set(exerciseNames)
  return DEFAULT_ROUTINE_DELETE_GUARD_TEMPLATES
    .filter(tpl => tpl.name === name && tpl.exercises.length === exerciseNames.length)
    .some(tpl => tpl.exercises.every(ex => exerciseSet.has(ex.exercise_name)))
}

export default async function TrainPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch routines
  const { data: routineRows } = await supabase
    .from('routines')
    .select('id, name, is_system')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  // Fetch exercise counts per routine
  const routineIds = (routineRows ?? []).map(r => r.id)
  const { data: exRows } = routineIds.length > 0
    ? await supabase
        .from('routine_exercises')
        .select('routine_id, exercise_name')
        .in('routine_id', routineIds)
    : { data: [] }

  const countsByRoutine = (exRows ?? []).reduce((acc, e) => {
    acc[e.routine_id] = (acc[e.routine_id] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const exercisesByRoutine = (exRows ?? []).reduce((acc, e) => {
    acc[e.routine_id] = [...(acc[e.routine_id] ?? []), e.exercise_name]
    return acc
  }, {} as Record<string, string[]>)

  const routines = (routineRows ?? []).map(r => ({
    id: r.id,
    name: r.name,
    exerciseCount: countsByRoutine[r.id] ?? 0,
    is_system: r.is_system ?? false,
    canDelete: !r.is_system && !isDefaultRoutine(r.name, exercisesByRoutine[r.id] ?? []),
  }))

  // Fetch completed workout sessions. A completed row can still be a partial planned workout.
  const { data: completedWorkoutRows } = await supabase
    .from('workouts')
    .select('id, completed_at, duration_minutes, routine_id, routines(name)')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })

  const completedWorkoutIds = (completedWorkoutRows ?? []).map(w => w.id)
  const completedRoutineIds = [
    ...new Set((completedWorkoutRows ?? []).map(w => w.routine_id).filter((id): id is string => Boolean(id))),
  ]

  let allWorkoutSets: {
    workout_id: string
    exercise_name: string
    weight_kg: number
    reps_completed: number
    set_type: string | null
  }[] = []
  if (completedWorkoutIds.length > 0) {
    const { data: sets } = await supabase
      .from('workout_sets')
      .select('workout_id, exercise_name, weight_kg, reps_completed, set_type')
      .in('workout_id', completedWorkoutIds)
      .limit(5000)
    allWorkoutSets = sets ?? []
  }

  let plannedExercisesByRoutine: Record<string, { exercise_name: string; sets_target: number }[]> = {}
  if (completedRoutineIds.length > 0) {
    const { data: plannedExercises } = await supabase
      .from('routine_exercises')
      .select('routine_id, exercise_name, sets_target')
      .in('routine_id', completedRoutineIds)

    plannedExercisesByRoutine = (plannedExercises ?? []).reduce((acc, exercise) => {
      acc[exercise.routine_id] = [...(acc[exercise.routine_id] ?? []), {
        exercise_name: exercise.exercise_name,
        sets_target: exercise.sets_target,
      }]
      return acc
    }, {} as Record<string, { exercise_name: string; sets_target: number }[]>)
  }

  const setsByWorkout = allWorkoutSets.reduce((acc, set) => {
    acc[set.workout_id] = [...(acc[set.workout_id] ?? []), set]
    return acc
  }, {} as Record<string, typeof allWorkoutSets>)

  const workoutsWithStatus = (completedWorkoutRows ?? []).map(workout => {
    const workoutSets = setsByWorkout[workout.id] ?? []
    const plannedExercises = workout.routine_id ? (plannedExercisesByRoutine[workout.routine_id] ?? []) : []
    const completionStatus = getWorkoutCompletionStatus(plannedExercises, workoutSets)
    return { workout, sets: workoutSets, completionStatus }
  })

  const lastWorkoutInfo = workoutsWithStatus[0] ?? null
  const programDayNames = new Set(THREE_DAY_TEMPLATE.map(day => day.name))
  const lastCompleteWorkoutInfo = workoutsWithStatus.find(w =>
    w.completionStatus.isComplete && programDayNames.has((w.workout.routines as any)?.name ?? '')
  ) ?? null

  const lastWorkout = lastWorkoutInfo ? {
    id: lastWorkoutInfo.workout.id,
    completedAt: lastWorkoutInfo.workout.completed_at as string,
    durationMinutes: lastWorkoutInfo.workout.duration_minutes as number | null,
    routineName: (lastWorkoutInfo.workout.routines as any)?.name ?? null,
    sets: lastWorkoutInfo.sets,
    isPartialSession: lastWorkoutInfo.completionStatus.isPartial,
    loggedWorkingSets: lastWorkoutInfo.completionStatus.loggedWorkingSets,
    plannedWorkingSets: lastWorkoutInfo.completionStatus.plannedWorkingSets,
  } : null

  const lastCompleteWorkout = lastCompleteWorkoutInfo ? {
    id: lastCompleteWorkoutInfo.workout.id,
    completedAt: lastCompleteWorkoutInfo.workout.completed_at as string,
    routineName: (lastCompleteWorkoutInfo.workout.routines as any)?.name ?? null,
  } : null

  const routineStatuses: Record<string, {
    status: 'complete' | 'partial'
    completedAt: string
    loggedWorkingSets: number
    plannedWorkingSets: number
  }> = {}
  for (const item of workoutsWithStatus) {
    const routineId = item.workout.routine_id
    if (!routineId || routineStatuses[routineId]) continue
    routineStatuses[routineId] = {
      status: item.completionStatus.isComplete ? 'complete' : 'partial',
      completedAt: item.workout.completed_at as string,
      loggedWorkingSets: item.completionStatus.loggedWorkingSets,
      plannedWorkingSets: item.completionStatus.plannedWorkingSets,
    }
  }

  return (
    <TrainClient
      userId={user.id}
      routines={routines}
      lastWorkout={lastWorkout}
      lastCompleteWorkout={lastCompleteWorkout}
      routineStatuses={routineStatuses}
    />
  )
}
