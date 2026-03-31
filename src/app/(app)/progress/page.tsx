import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProgressClient from './ProgressClient'

export default async function ProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: entries } = await supabase
    .from('weight_entries')
    .select('id, weight, trend_weight, date')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(30)

  const { data: profile } = await supabase
    .from('profiles')
    .select('goal, current_weight')
    .eq('id', user.id)
    .single()

  return (
    <ProgressClient
      userId={user.id}
      initialEntries={entries ?? []}
      goal={profile?.goal ?? 'recomp'}
      currentWeight={profile?.current_weight ?? null}
    />
  )
}
