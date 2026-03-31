import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ActiveWorkoutClient from './ActiveWorkoutClient'

interface Props {
  params: Promise<{ workoutId: string }>
  searchParams: Promise<{ dayId?: string }>
}

export default async function ActiveWorkoutPage({ params, searchParams }: Props) {
  const { workoutId } = await params
  const { dayId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify workout belongs to user
  const { data: workout } = await supabase
    .from('workouts')
    .select('id, started_at, program_day_id')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .single()

  if (!workout) redirect('/app/train')

  const resolvedDayId = dayId ?? workout.program_day_id

  // Fetch day exercises
  let exercises: {
    id: string
    exercise_name: string
    exercise_category: string
    muscle_group: string
    sets_target: number
    reps_min: number
    reps_max: number
    rest_seconds: number
    notes: string | null
    progression_type: string
  }[] = []

  if (resolvedDayId) {
    const { data } = await supabase
      .from('program_exercises')
      .select('*')
      .eq('program_day_id', resolvedDayId)
      .order('exercise_order', { ascending: true })
    exercises = data ?? []
  }

  // THE ENGINE GAP FIX: fetch exercise_targets for every exercise in this day
  // This is what the Android app was computing but never reading back.
  const exerciseNames = exercises.map(e => e.exercise_name)
  const { data: targetRows } = await supabase
    .from('exercise_targets')
    .select('exercise_name, set_number, target_weight_kg, target_reps_min, target_reps_max')
    .eq('user_id', user.id)
    .in('exercise_name', exerciseNames.length > 0 ? exerciseNames : ['__none__'])

  // Build a lookup: exerciseName → set_number → target
  const targets: Record<string, Record<number, { weight: number; repsMin: number; repsMax: number }>> = {}
  for (const row of targetRows ?? []) {
    if (!targets[row.exercise_name]) targets[row.exercise_name] = {}
    targets[row.exercise_name][row.set_number] = {
      weight: row.target_weight_kg,
      repsMin: row.target_reps_min,
      repsMax: row.target_reps_max,
    }
  }

  // Fetch user profile for goal context (used by progression engine)
  const { data: profile } = await supabase
    .from('profiles')
    .select('goal, current_weight')
    .eq('id', user.id)
    .single()

  return (
    <ActiveWorkoutClient
      workoutId={workoutId}
      exercises={exercises}
      suggestedTargets={targets}
      goal={profile?.goal ?? 'recomp'}
      userWeight={profile?.current_weight ?? 80}
    />
  )
}
