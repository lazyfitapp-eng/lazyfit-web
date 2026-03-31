'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function StartWorkoutButton({ dayId, dayName }: { dayId: string; dayName: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleStart = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data, error } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        program_day_id: dayId,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('startWorkout error:', error)
      setLoading(false)
      return
    }

    router.push(`/app/train/${data.id}?dayId=${dayId}`)
  }

  return (
    <button
      onClick={handleStart}
      disabled={loading}
      className="w-full mt-4 py-2.5 border border-primary text-primary text-xs font-bold tracking-widest rounded hover:bg-primary hover:text-black transition-all disabled:opacity-40"
    >
      {loading ? 'STARTING...' : `START ${dayName.toUpperCase()}`}
    </button>
  )
}
