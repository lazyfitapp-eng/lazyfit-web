import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const twoWeeksAgo  = new Date(Date.now() - 14  * 86400000).toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7   * 86400000).toISOString().split('T')[0]
  const thirtyDaysAgo   = new Date(Date.now() - 30  * 86400000).toISOString().split('T')[0]
  const ninetyDaysAgo   = new Date(Date.now() - 90  * 86400000).toISOString().split('T')[0]

  const [
    { data: profile },
    { data: todayLogs },
    { data: weightEntries },
    { data: prevWeekWeightEntries },
    { data: recentFoodActivity },
    { data: recentWorkouts },
    { data: weekFoodLogs },
    { data: weekWorkouts },
    { data: chartWeightRaw },
    { data: chartFoodRaw },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('food_logs')
      .select('id, food_name, calories, protein, carbs, fat, meal_type, quantity')
      .eq('user_id', user.id)
      .gte('logged_at', `${today}T00:00:00`)
      .lte('logged_at', `${today}T23:59:59`),
    supabase
      .from('weight_entries')
      .select('weight, trend_weight, date')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(7),
    supabase
      .from('weight_entries')
      .select('weight, date')
      .eq('user_id', user.id)
      .lte('date', sevenDaysAgo)
      .order('date', { ascending: false })
      .limit(1),
    supabase
      .from('food_logs')
      .select('logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', `${twoWeeksAgo}T00:00:00`),
    supabase
      .from('workouts')
      .select('started_at')
      .eq('user_id', user.id)
      .gte('started_at', `${twoWeeksAgo}T00:00:00`)
      .order('started_at', { ascending: false }),
    supabase
      .from('food_logs')
      .select('calories, protein')
      .eq('user_id', user.id)
      .gte('logged_at', `${sevenDaysAgo}T00:00:00`),
    supabase
      .from('workouts')
      .select('id')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .gte('started_at', `${sevenDaysAgo}T00:00:00`),
    // Chart data for Progress sub-tab
    supabase
      .from('weight_entries')
      .select('weight, trend_weight, date')
      .eq('user_id', user.id)
      .gte('date', ninetyDaysAgo)
      .order('date', { ascending: true }),
    supabase
      .from('food_logs')
      .select('logged_at, calories')
      .eq('user_id', user.id)
      .gte('logged_at', `${thirtyDaysAgo}T00:00:00`),
  ])

  // Activity dots for WeekStrip
  const activityByDate: Record<string, { food: boolean; workout: boolean }> = {}
  for (const log of recentFoodActivity ?? []) {
    const date = (log.logged_at as string).split('T')[0]
    if (!activityByDate[date]) activityByDate[date] = { food: false, workout: false }
    activityByDate[date].food = true
  }
  for (const w of recentWorkouts ?? []) {
    const date = (w.started_at as string).split('T')[0]
    if (!activityByDate[date]) activityByDate[date] = { food: false, workout: false }
    activityByDate[date].workout = true
  }

  // Weekly delta
  const latestWeight = weightEntries?.[0]    // most recent (limit 7 now)
  const recentWeights = (weightEntries ?? []).map(e => e.weight)
  const prevWeekWeight = prevWeekWeightEntries?.[0]
  const weeklyDelta =
    latestWeight?.weight && prevWeekWeight?.weight
      ? Math.round((latestWeight.weight - prevWeekWeight.weight) * 10) / 10
      : null

  // Days since last workout
  const lastWorkoutDate = recentWorkouts?.[0]?.started_at
  const daysSinceWorkout = lastWorkoutDate
    ? Math.floor((Date.now() - new Date(lastWorkoutDate).getTime()) / 86400000)
    : 99

  // Check-in averages
  const weekCalTotal = (weekFoodLogs ?? []).reduce((s, l) => s + (l.calories ?? 0), 0)
  const weekProtTotal = (weekFoodLogs ?? []).reduce((s, l) => s + (l.protein ?? 0), 0)

  // Chart data for Progress sub-tab
  const chartWeightEntries = (chartWeightRaw ?? []) as { date: string; weight: number; trend_weight: number }[]
  const chartFoodByDay: Record<string, number> = {}
  for (const log of chartFoodRaw ?? []) {
    const date = (log.logged_at as string).split('T')[0]
    chartFoodByDay[date] = (chartFoodByDay[date] ?? 0) + (log.calories ?? 0)
  }
  const chartFoodLogs = Object.entries(chartFoodByDay)
    .map(([date, calories]) => ({ date, calories }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <DashboardClient
      userId={user.id}
      today={today}
      initialLogs={(todayLogs ?? []) as any}
      activityByDate={activityByDate}
      latestWeight={latestWeight?.weight ?? null}
      trendWeight={latestWeight?.trend_weight ?? null}
      weeklyDelta={weeklyDelta}
      daysSinceWorkout={daysSinceWorkout}
      recentWeights={recentWeights}
      targets={{
        calories: profile?.target_calories ?? 0,
        protein:  profile?.target_protein  ?? 0,
        carbs:    profile?.target_carbs    ?? 0,
        fat:      profile?.target_fat      ?? 0,
        trainingDaysPerWeek: profile?.training_days_per_week ?? 3,
      }}
      checkin={{
        currentWeight:    latestWeight?.weight ?? null,
        prevWeight:       prevWeekWeight?.weight ?? null,
        avgCalories:      Math.round(weekCalTotal / 7),
        avgProtein:       Math.round(weekProtTotal / 7),
        workoutsThisWeek: weekWorkouts?.length ?? 0,
      }}
      chartWeightEntries={chartWeightEntries}
      chartFoodLogs={chartFoodLogs}
    />
  )
}
