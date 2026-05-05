import { createClient } from '@/lib/supabase/server'
import { resolveNutritionTargets } from '@/lib/nutritionTargets'
import { getLocalDateDaysAgo, getLocalDateString, getLocalDayBounds, parseDateParamSafe, parseLocalDateString } from '@/lib/dateUtils'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { date: rawDate } = await searchParams
  const today = getLocalDateString()
  const selectedDate = parseDateParamSafe(typeof rawDate === 'string' ? rawDate : undefined, today)
  const twoWeeksAgo = getLocalDateDaysAgo(14)
  const sevenDaysAgo = getLocalDateDaysAgo(7)
  const thirtyDaysAgo = getLocalDateDaysAgo(30)
  const ninetyDaysAgo = getLocalDateDaysAgo(90)
  const selectedDateBounds = getLocalDayBounds(selectedDate)
  const twoWeeksAgoBounds = getLocalDayBounds(twoWeeksAgo)
  const sevenDaysAgoBounds = getLocalDayBounds(sevenDaysAgo)
  const thirtyDaysAgoBounds = getLocalDayBounds(thirtyDaysAgo)

  const [
    { data: profile },
    { data: selectedDateLogs },
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
      .gte('logged_at', selectedDateBounds.start)
      .lte('logged_at', selectedDateBounds.end),
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
      .gte('logged_at', twoWeeksAgoBounds.start),
    supabase
      .from('workouts')
      .select('started_at')
      .eq('user_id', user.id)
      .gte('started_at', twoWeeksAgoBounds.start)
      .order('started_at', { ascending: false }),
    supabase
      .from('food_logs')
      .select('calories, protein, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', sevenDaysAgoBounds.start),
    supabase
      .from('workouts')
      .select('id')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .gte('started_at', sevenDaysAgoBounds.start),
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
      .gte('logged_at', thirtyDaysAgoBounds.start),
  ])

  // Activity dots for WeekStrip
  const activityByDate: Record<string, { food: boolean; workout: boolean }> = {}
  for (const log of recentFoodActivity ?? []) {
    const date = getLocalDateString(new Date(log.logged_at as string))
    if (!activityByDate[date]) activityByDate[date] = { food: false, workout: false }
    activityByDate[date].food = true
  }
  for (const w of recentWorkouts ?? []) {
    const date = getLocalDateString(new Date(w.started_at as string))
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
  const todayDate = parseLocalDateString(today)
  const lastWorkoutLocalDate = lastWorkoutDate
    ? parseLocalDateString(getLocalDateString(new Date(lastWorkoutDate)))
    : null
  const daysSinceWorkout = todayDate && lastWorkoutLocalDate
    ? Math.floor((todayDate.getTime() - lastWorkoutLocalDate.getTime()) / 86400000)
    : 99

  // Check-in averages
  const weekCalTotal = (weekFoodLogs ?? []).reduce((s, l) => s + (l.calories ?? 0), 0)
  const weekProtTotal = (weekFoodLogs ?? []).reduce((s, l) => s + (l.protein ?? 0), 0)
  const foodDaysThisWeek = new Set(
    (weekFoodLogs ?? []).map(l => getLocalDateString(new Date(l.logged_at as string)))
  ).size
  const hasMeaningfulCheckinData =
    (weekWorkouts?.length ?? 0) >= 1 ||
    (weightEntries?.length ?? 0) >= 2 ||
    foodDaysThisWeek >= 3

  // Chart data for Progress sub-tab
  const chartWeightEntries = (chartWeightRaw ?? []) as { date: string; weight: number; trend_weight: number }[]
  const chartFoodByDay: Record<string, number> = {}
  for (const log of chartFoodRaw ?? []) {
    const date = getLocalDateString(new Date(log.logged_at as string))
    chartFoodByDay[date] = (chartFoodByDay[date] ?? 0) + (log.calories ?? 0)
  }
  const chartFoodLogs = Object.entries(chartFoodByDay)
    .map(([date, calories]) => ({ date, calories }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const resolvedTargets = resolveNutritionTargets(profile)
  const dashboardTargets = {
    ...resolvedTargets,
    trainingDaysPerWeek: profile?.training_days_per_week ?? 3,
  }

  return (
    <DashboardClient
      userId={user.id}
      today={today}
      selectedDate={selectedDate}
      initialLogs={(selectedDateLogs ?? []) as any}
      activityByDate={activityByDate}
      latestWeight={latestWeight?.weight ?? null}
      trendWeight={latestWeight?.trend_weight ?? null}
      weeklyDelta={weeklyDelta}
      daysSinceWorkout={daysSinceWorkout}
      recentWeights={recentWeights}
      targets={dashboardTargets}
      checkin={{
        currentWeight:    latestWeight?.weight ?? null,
        prevWeight:       prevWeekWeight?.weight ?? null,
        avgCalories:      Math.round(weekCalTotal / 7),
        avgProtein:       Math.round(weekProtTotal / 7),
        workoutsThisWeek: weekWorkouts?.length ?? 0,
        hasMeaningfulData: hasMeaningfulCheckinData,
        activityFloorAtCheckin: profile?.daily_steps ?? null,
      }}
      chartWeightEntries={chartWeightEntries}
      chartFoodLogs={chartFoodLogs}
    />
  )
}
