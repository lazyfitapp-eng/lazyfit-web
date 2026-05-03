import { createClient } from '@/lib/supabase/server'
import { DEFAULT_ROUTINE_DELETE_GUARD_TEMPLATES } from '@/lib/createDefaultRoutines'
import { redirect } from 'next/navigation'
import TrainClient from './TrainClient'

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

  // Fetch last completed workout
  const { data: lastWorkoutRows } = await supabase
    .from('workouts')
    .select('id, completed_at, duration_minutes, routine_id, routines(name)')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)

  const lastWorkoutRow = lastWorkoutRows?.[0] ?? null

  // Fetch sets for last workout (volume + muscle split)
  let lastWorkoutSets: { exercise_name: string; weight_kg: number; reps_completed: number }[] = []
  if (lastWorkoutRow) {
    const { data: sets } = await supabase
      .from('workout_sets')
      .select('exercise_name, weight_kg, reps_completed')
      .eq('workout_id', lastWorkoutRow.id)
    lastWorkoutSets = sets ?? []
  }

  const lastWorkout = lastWorkoutRow ? {
    id: lastWorkoutRow.id,
    completedAt: lastWorkoutRow.completed_at as string,
    durationMinutes: lastWorkoutRow.duration_minutes as number | null,
    routineName: (lastWorkoutRow.routines as any)?.name ?? null,
    sets: lastWorkoutSets,
  } : null

  return (
    <TrainClient
      userId={user.id}
      routines={routines}
      lastWorkout={lastWorkout}
    />
  )
}
