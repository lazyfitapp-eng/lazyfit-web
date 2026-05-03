import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { count: weightEntryCount }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
    supabase
      .from('weight_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  return <ProfileClient user={user} profile={profile} weightEntryCount={weightEntryCount ?? 0} />
}
