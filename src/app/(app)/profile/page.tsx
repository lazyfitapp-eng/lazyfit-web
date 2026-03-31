import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-widest text-muted-foreground">SETTINGS</p>
        <h2 className="text-xl font-bold tracking-widest text-white mt-0.5">PROFILE & GOALS</h2>
      </div>

      {/* Account */}
      <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-5">
        <p className="text-xs tracking-widest text-muted-foreground mb-4">ACCOUNT</p>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">Email</span>
            <span className="text-xs text-white font-mono">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">Status</span>
            <span className="text-xs text-primary font-mono tracking-widest">
              {profile?.subscription_status?.toUpperCase() ?? 'BETA'}
            </span>
          </div>
        </div>
      </div>

      {/* Daily targets */}
      <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-5">
        <p className="text-xs tracking-widest text-muted-foreground mb-4">DAILY TARGETS</p>
        <div className="space-y-3">
          {[
            { label: 'Calories', value: `${profile?.target_calories ?? 0} kcal` },
            { label: 'Protein', value: `${profile?.target_protein ?? 0}g` },
            { label: 'Carbs', value: `${profile?.target_carbs ?? 0}g` },
            { label: 'Fat', value: `${profile?.target_fat ?? 0}g` },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xs text-white font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-5">
        <p className="text-xs tracking-widest text-muted-foreground mb-4">BODY</p>
        <div className="space-y-3">
          {[
            { label: 'Goal', value: profile?.goal?.toUpperCase() ?? '—' },
            { label: 'Current weight', value: profile?.current_weight ? `${profile.current_weight} kg` : '—' },
            { label: 'Height', value: profile?.height_cm ? `${profile.height_cm} cm` : '—' },
            { label: 'Age', value: profile?.age ?? '—' },
            { label: 'Sex', value: profile?.sex ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xs text-white font-mono">{String(value)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground pt-4">
        Profile editing coming soon.
      </p>
    </div>
  )
}
