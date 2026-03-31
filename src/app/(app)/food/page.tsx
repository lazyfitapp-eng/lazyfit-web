import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FoodClient from './FoodClient'

export default async function FoodPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const { data: foodLogs } = await supabase
    .from('food_logs')
    .select('id, food_name, calories, protein, carbs, fat, quantity, meal_type, logged_at')
    .eq('user_id', user.id)
    .gte('logged_at', `${today}T00:00:00`)
    .lte('logged_at', `${today}T23:59:59`)
    .order('logged_at', { ascending: true })

  const { data: profile } = await supabase
    .from('profiles')
    .select('target_calories, target_protein, target_carbs, target_fat')
    .eq('id', user.id)
    .single()

  return (
    <FoodClient
      userId={user.id}
      initialLogs={foodLogs ?? []}
      targets={{
        calories: profile?.target_calories ?? 2000,
        protein: profile?.target_protein ?? 150,
        carbs: profile?.target_carbs ?? 200,
        fat: profile?.target_fat ?? 70,
      }}
    />
  )
}
