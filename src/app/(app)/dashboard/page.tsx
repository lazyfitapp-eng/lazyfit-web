import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function MacroBar({ label, current, target, color }: {
  label: string
  current: number
  target: number
  color: string
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground tracking-widest">{label}</span>
        <span className="text-white font-mono">{current}g <span className="text-muted-foreground">/ {target}g</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-[#111111] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch today's food logs
  const today = new Date().toISOString().split('T')[0]
  const { data: foodLogs } = await supabase
    .from('food_logs')
    .select('calories, protein, carbs, fat')
    .eq('user_id', user.id)
    .gte('logged_at', `${today}T00:00:00`)
    .lte('logged_at', `${today}T23:59:59`)

  // Fetch latest weight entry
  const { data: weightEntries } = await supabase
    .from('weight_entries')
    .select('weight, trend_weight, date')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(1)

  const consumed = (foodLogs ?? []).reduce(
    (acc, log) => ({
      calories: acc.calories + (log.calories ?? 0),
      protein: acc.protein + (log.protein ?? 0),
      carbs: acc.carbs + (log.carbs ?? 0),
      fat: acc.fat + (log.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const targets = {
    calories: profile?.target_calories ?? 0,
    protein: profile?.target_protein ?? 0,
    carbs: profile?.target_carbs ?? 0,
    fat: profile?.target_fat ?? 0,
  }

  const caloriePct = targets.calories > 0
    ? Math.min(Math.round((consumed.calories / targets.calories) * 100), 100)
    : 0

  const latestWeight = weightEntries?.[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest text-muted-foreground">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}
          </p>
          <h2 className="text-xl font-bold tracking-widest text-white mt-0.5">TODAY</h2>
        </div>
        <Link href="/app/profile" className="text-muted-foreground hover:text-primary transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </Link>
      </div>

      {/* Calorie ring card */}
      <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-5">
        <p className="text-xs tracking-widest text-muted-foreground mb-4">CALORIES</p>

        {/* Big number */}
        <div className="flex items-end gap-2 mb-4">
          <span className="text-5xl font-bold text-white font-mono">{consumed.calories}</span>
          <span className="text-muted-foreground text-sm mb-1.5">/ {targets.calories} kcal</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-[#111111] overflow-hidden mb-1">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${caloriePct}%`,
              backgroundColor: caloriePct >= 100 ? '#FF0040' : '#00FF41',
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {targets.calories - consumed.calories > 0
            ? `${targets.calories - consumed.calories} kcal remaining`
            : `${consumed.calories - targets.calories} kcal over target`}
        </p>
      </div>

      {/* Macros card */}
      <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-5 space-y-4">
        <p className="text-xs tracking-widest text-muted-foreground">MACROS</p>
        <MacroBar label="PROTEIN" current={Math.round(consumed.protein)} target={targets.protein} color="#00FF41" />
        <MacroBar label="CARBS" current={Math.round(consumed.carbs)} target={targets.carbs} color="#00CC33" />
        <MacroBar label="FAT" current={Math.round(consumed.fat)} target={targets.fat} color="#FFAA00" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/app/food"
          className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-4 hover:border-primary transition-colors group"
        >
          <p className="text-xs tracking-widest text-muted-foreground group-hover:text-primary mb-1">LOG FOOD</p>
          <p className="text-lg font-bold text-white">+</p>
        </Link>
        <Link
          href="/app/train"
          className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-4 hover:border-primary transition-colors group"
        >
          <p className="text-xs tracking-widest text-muted-foreground group-hover:text-primary mb-1">TRAIN</p>
          <p className="text-lg font-bold text-white">▶</p>
        </Link>
        <Link
          href="/app/progress"
          className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-4 hover:border-primary transition-colors group"
        >
          <p className="text-xs tracking-widest text-muted-foreground group-hover:text-primary mb-1">WEIGHT</p>
          <p className="text-lg font-bold text-white font-mono">
            {latestWeight ? `${latestWeight.weight} kg` : '—'}
          </p>
        </Link>
        <Link
          href="/app/progress"
          className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-4 hover:border-primary transition-colors group"
        >
          <p className="text-xs tracking-widest text-muted-foreground group-hover:text-primary mb-1">TREND</p>
          <p className="text-lg font-bold text-white font-mono">
            {latestWeight?.trend_weight ? `${latestWeight.trend_weight} kg` : '—'}
          </p>
        </Link>
      </div>

      {/* Goal badge */}
      {profile?.goal && (
        <div className="border border-[#222222] rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs tracking-widest text-muted-foreground">CURRENT GOAL</p>
            <p className="text-sm font-bold text-primary mt-0.5 tracking-widest">
              {profile.goal === 'cut' ? 'LOSE FAT'
                : profile.goal === 'bulk' ? 'BUILD MUSCLE'
                : 'RECOMPOSITION'}
            </p>
          </div>
          <Link href="/app/profile" className="text-xs text-muted-foreground hover:text-primary transition-colors tracking-widest">
            EDIT
          </Link>
        </div>
      )}
    </div>
  )
}
