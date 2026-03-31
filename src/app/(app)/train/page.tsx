import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StartWorkoutButton from './StartWorkoutButton'

export default async function TrainPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch active program
  const { data: programs } = await supabase
    .from('programs')
    .select('id, name, description, days_per_week')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)

  const program = programs?.[0] ?? null

  // Fetch days + exercises if program exists
  let days: { id: string; day_name: string; day_order: number; focus: string | null; exercises: { exercise_name: string; sets_target: number; reps_min: number; reps_max: number }[] }[] = []

  if (program) {
    const { data: dayRows } = await supabase
      .from('program_days')
      .select('id, day_name, day_order, focus')
      .eq('program_id', program.id)
      .order('day_order', { ascending: true })

    if (dayRows) {
      days = await Promise.all(
        dayRows.map(async (day) => {
          const { data: exercises } = await supabase
            .from('program_exercises')
            .select('exercise_name, sets_target, reps_min, reps_max')
            .eq('program_day_id', day.id)
            .order('exercise_order', { ascending: true })
          return { ...day, exercises: exercises ?? [] }
        })
      )
    }
  }

  // Fetch recent workouts
  const { data: recentWorkouts } = await supabase
    .from('workouts')
    .select('id, started_at, completed_at, program_days(day_name)')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest text-muted-foreground">MODULE</p>
          <h2 className="text-xl font-bold tracking-widest text-white mt-0.5">TRAIN</h2>
        </div>
      </div>

      {/* Active program */}
      {program ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs tracking-widest text-primary">ACTIVE PROGRAM</p>
          </div>
          <div className="bg-[#0a0a0a] border border-primary/30 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-bold text-white tracking-widest">{program.name}</h3>
            {program.description && (
              <p className="text-xs text-muted-foreground mt-1">{program.description}</p>
            )}
            <p className="text-xs text-primary mt-2">{program.days_per_week}x / week</p>
          </div>

          {/* Day cards */}
          <div className="space-y-3">
            {days.map((day) => (
              <div key={day.id} className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white tracking-widest">{day.day_name}</p>
                    {day.focus && (
                      <p className="text-xs text-muted-foreground mt-0.5">{day.focus}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {day.exercises.length} exercises
                  </span>
                </div>

                {/* Exercise preview */}
                {day.exercises.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {day.exercises.slice(0, 4).map((ex, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{ex.exercise_name}</span>
                        <span className="text-xs text-[#555555] font-mono">
                          {ex.sets_target}×{ex.reps_min}–{ex.reps_max}
                        </span>
                      </div>
                    ))}
                    {day.exercises.length > 4 && (
                      <p className="text-xs text-[#444444]">+{day.exercises.length - 4} more</p>
                    )}
                  </div>
                )}

                <StartWorkoutButton dayId={day.id} dayName={day.day_name} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-8 text-center">
          <p className="text-xs tracking-widest text-primary mb-3">NO PROGRAM YET</p>
          <p className="text-muted-foreground text-sm">
            Your workout program will appear here. Create one from the Android app or wait for the web builder.
          </p>
        </div>
      )}

      {/* Recent workouts */}
      {recentWorkouts && recentWorkouts.length > 0 && (
        <div>
          <p className="text-xs tracking-widest text-muted-foreground mb-3">RECENT SESSIONS</p>
          <div className="space-y-2">
            {recentWorkouts.map((w: any) => {
              const date = new Date(w.completed_at)
              const dayName = w.program_days?.day_name ?? 'Workout'
              return (
                <div key={w.id} className="flex items-center justify-between bg-[#0a0a0a] border border-[#222222] rounded-lg px-4 py-3">
                  <div>
                    <p className="text-xs text-white font-bold tracking-widest">{dayName}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className="text-xs text-primary">✓</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
