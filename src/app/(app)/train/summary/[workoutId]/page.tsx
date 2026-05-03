import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import SummaryClient from './SummaryClient'

interface PageProps {
  params: Promise<{ workoutId: string }>
}

export default async function SummaryPage({ params }: PageProps) {
  const { workoutId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch workout + routine name
  const { data: workout } = await supabase
    .from('workouts')
    .select('id, completed_at, duration_minutes, routine_id, routines(name)')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .single()

  if (!workout) notFound()

  // Fetch all sets for this workout
  const { data: sets } = await supabase
    .from('workout_sets')
    .select('exercise_name, set_number, weight_kg, reps_completed, set_type')
    .eq('workout_id', workoutId)
    .order('set_number', { ascending: true })

  const workoutSets = sets ?? []
  const exerciseNames = [...new Set(workoutSets.map(s => s.exercise_name))]
  let isPartialSession = false

  if (workout.routine_id) {
    const { data: plannedExercises } = await supabase
      .from('routine_exercises')
      .select('exercise_name, sets_target')
      .eq('routine_id', workout.routine_id)

    const loggedWorkingCounts = new Map<string, number>()
    for (const s of workoutSets) {
      if (s.set_type === 'warmup') continue
      loggedWorkingCounts.set(s.exercise_name, (loggedWorkingCounts.get(s.exercise_name) ?? 0) + 1)
    }

    isPartialSession = (plannedExercises ?? []).some(ex =>
      (loggedWorkingCounts.get(ex.exercise_name) ?? 0) < ex.sets_target
    )
  }

  // Fetch all-time best 1RM per exercise (excluding this workout)
  let allTimeBest: Record<string, number> = {}
  if (exerciseNames.length > 0) {
    const { data: historical } = await supabase
      .from('workout_sets')
      .select('exercise_name, weight_kg, reps_completed, workout_id')
      .in('exercise_name', exerciseNames)
      .neq('workout_id', workoutId)

    const { data: userWorkoutIds } = await supabase
      .from('workouts')
      .select('id')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .neq('id', workoutId)

    const validIds = new Set((userWorkoutIds ?? []).map(w => w.id))
    const userHistorical = (historical ?? []).filter(s => validIds.has(s.workout_id))

    for (const s of userHistorical) {
      const rm = s.weight_kg * (1 + s.reps_completed / 30)
      if (!allTimeBest[s.exercise_name] || rm > allTimeBest[s.exercise_name]) {
        allTimeBest[s.exercise_name] = rm
      }
    }
  }

  // Fetch exercise_targets for coaching section
  const { data: targets } = exerciseNames.length > 0
    ? await supabase
        .from('exercise_targets')
        .select('exercise_name, set_number, target_weight_kg, target_reps_min, target_reps_max')
        .eq('user_id', user.id)
        .in('exercise_name', exerciseNames)
    : { data: [] }

  // Group targets by exercise → set_number
  const targetsByExercise: Record<string, Record<number, { weight: number; repsMin: number; repsMax: number }>> = {}
  for (const t of (targets ?? [])) {
    if (!targetsByExercise[t.exercise_name]) targetsByExercise[t.exercise_name] = {}
    targetsByExercise[t.exercise_name][t.set_number] = {
      weight: t.target_weight_kg,
      repsMin: t.target_reps_min,
      repsMax: t.target_reps_max,
    }
  }

  // Previous workout's best weight per exercise (for delta badges)
  let prevBestWeight: Record<string, number> = {}
  if (workout.routine_id) {
    const { data: prevWorkout } = await supabase
      .from('workouts')
      .select('id')
      .eq('user_id', user.id)
      .eq('routine_id', workout.routine_id)
      .not('completed_at', 'is', null)
      .lt('completed_at', workout.completed_at as string)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (prevWorkout) {
      const { data: prevSets } = await supabase
        .from('workout_sets')
        .select('exercise_name, weight_kg')
        .eq('workout_id', prevWorkout.id)
        .neq('set_type', 'warmup')
      for (const s of prevSets ?? []) {
        if (!prevBestWeight[s.exercise_name] || s.weight_kg > prevBestWeight[s.exercise_name]) {
          prevBestWeight[s.exercise_name] = s.weight_kg
        }
      }
    }
  }

  // Session count + days training (for identity line)
  let sessionCount = 1
  let daysTraining = 0
  if (workout.routine_id) {
    const { data: sessionData } = await supabase
      .from('workouts')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('routine_id', workout.routine_id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: true })

    sessionCount = sessionData?.length ?? 1
    if (sessionData && sessionData.length > 0) {
      const first = new Date(sessionData[0].completed_at)
      const now = new Date()
      daysTraining = Math.max(1, Math.round((now.getTime() - first.getTime()) / 86400000))
    }
  }

  return (
    <SummaryClient
      workoutId={workoutId}
      routineName={(workout.routines as any)?.name ?? null}
      routineId={workout.routine_id ?? null}
      completedAt={workout.completed_at as string}
      durationMinutes={workout.duration_minutes as number | null}
      sets={workoutSets}
      allTimeBest={allTimeBest}
      targets={targetsByExercise}
      userId={user.id}
      prevBestWeight={prevBestWeight}
      sessionCount={sessionCount}
      daysTraining={daysTraining}
      isPartialSession={isPartialSession}
    />
  )
}
