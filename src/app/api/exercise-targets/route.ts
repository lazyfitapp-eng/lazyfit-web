import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const targets: Record<number, { weight: number; repsMin: number; repsMax: number; consecutiveMax: number; consecutiveFail: number }> = {}
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
    .select('id, completed_at')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(50)

  if (workoutId) recentQuery = recentQuery.neq('id', workoutId)

  const { data: recentWorkouts } = await recentQuery

  const lastSession: Record<number, { weight: number; reps: number }> = {}

  if ((recentWorkouts ?? []).length > 0) {
    const recentIds = recentWorkouts!.map(w => w.id)
    const completedAtById: Record<string, string> = {}
    for (const w of recentWorkouts!) completedAtById[w.id] = w.completed_at as string

    // Query 3: sets for this exercise across recent workouts
    const { data: prevSets } = await supabase
      .from('workout_sets')
      .select('set_number, weight_kg, reps_completed, workout_id')
      .in('workout_id', recentIds)
      .eq('exercise_name', name)
      .or('set_type.is.null,set_type.eq.working')

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
