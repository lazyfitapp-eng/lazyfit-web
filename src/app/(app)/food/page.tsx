import { createClient } from '@/lib/supabase/server'
import { resolveNutritionTargets } from '@/lib/nutritionTargets'
import { getLocalDateString, getLocalDayBounds, parseDateParamSafe } from '@/lib/dateUtils'
import { redirect } from 'next/navigation'
import FoodClient from './FoodClient'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = typeof MEAL_TYPES[number]
const FOOD_LOG_SELECT = 'id, food_id, food_name, calories, protein, carbs, fat, fiber, quantity, meal_type, logged_at'

function parseMealParamSafe(meal: string | string[] | undefined): MealType | null {
  if (typeof meal !== 'string') return null
  return MEAL_TYPES.includes(meal as MealType) ? meal as MealType : null
}

export default async function FoodPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[]; meal?: string | string[] }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { date: rawDate, meal: rawMeal } = await searchParams
  const today = getLocalDateString()
  const date = parseDateParamSafe(typeof rawDate === 'string' ? rawDate : undefined, today)
  const initialMeal = parseMealParamSafe(rawMeal)
  const dayBounds = getLocalDayBounds(date)

  const [{ data: foodLogs }, { data: recentFoodLogs }, { data: profile }, { data: dayNoteRow }] = await Promise.all([
    supabase
      .from('food_logs')
      .select(FOOD_LOG_SELECT)
      .eq('user_id', user.id)
      .gte('logged_at', dayBounds.start)
      .lte('logged_at', dayBounds.end)
      .order('logged_at', { ascending: true }),

    supabase
      .from('food_logs')
      .select(FOOD_LOG_SELECT)
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(40),

    supabase
      .from('profiles')
      .select('goal, current_weight, height_cm, age, date_of_birth, sex, job_activity, daily_steps, target_calories, target_protein, target_carbs, target_fat')
      .eq('id', user.id)
      .single(),

    supabase
      .from('day_notes')
      .select('note')
      .eq('user_id', user.id)
      .eq('date', date)
      .maybeSingle(),
  ])

  return (
    <FoodClient
      userId={user.id}
      initialLogs={foodLogs ?? []}
      initialRecentLogs={recentFoodLogs ?? []}
      targets={resolveNutritionTargets(profile, { calories: 2000, protein: 150, carbs: 200, fat: 70 })}
      date={date}
      initialMeal={initialMeal}
      dayNote={dayNoteRow?.note ?? ''}
    />
  )
}
