import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FoodClient from './FoodClient'

export default async function FoodPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { date: rawDate } = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate ?? '') ? rawDate! : today

  const [{ data: foodLogs }, { data: profile }, { data: dayNoteRow }] = await Promise.all([
    supabase
      .from('food_logs')
      .select('id, food_name, calories, protein, carbs, fat, fiber, quantity, meal_type, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', `${date}T00:00:00`)
      .lte('logged_at', `${date}T23:59:59`)
      .order('logged_at', { ascending: true }),

    supabase
      .from('profiles')
      .select('target_calories, target_protein, target_carbs, target_fat')
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
      targets={{
        calories: profile?.target_calories ?? 2000,
        protein:  profile?.target_protein  ?? 150,
        carbs:    profile?.target_carbs    ?? 200,
        fat:      profile?.target_fat      ?? 70,
      }}
      date={date}
      dayNote={dayNoteRow?.note ?? ''}
    />
  )
}
