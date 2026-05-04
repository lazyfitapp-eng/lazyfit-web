'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getLocalWeekStartString } from '@/lib/dateUtils'
import WeeklyCheckin, { WeeklyCheckinBanner } from './WeeklyCheckin'

const CHECKIN_KEY = 'lf_checkin_week'

interface Props {
  userId: string
  currentWeight: number | null
  prevWeight: number | null
  avgCalories: number
  targetCalories: number
  avgProtein: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
  workoutsThisWeek: number
  targetDaysPerWeek: number
  activityFloorAtCheckin: string | null
}

export default function WeeklyCheckinWrapper(props: Props) {
  const [isDue, setIsDue] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    const supabase = createClient()
    const currentWeekStart = getLocalWeekStartString()

    ;(async () => {
      const saved = localStorage.getItem(CHECKIN_KEY)
      const { data } = await supabase
        .from('weekly_checkins')
        .select('id')
        .eq('user_id', props.userId)
        .eq('week_start', currentWeekStart)
        .maybeSingle()

      if (!alive) return

      if (data?.id) {
        localStorage.setItem(CHECKIN_KEY, currentWeekStart)
        setIsDue(false)
        return
      }

      setIsDue(saved !== currentWeekStart)
    })()

    return () => {
      alive = false
    }
  }, [props.userId])

  if (!isDue) return null

  return (
    <>
      <WeeklyCheckinBanner onClick={() => setOpen(true)} />
      {open && (
        <WeeklyCheckin
          {...props}
          key="checkin"
          onClose={() => setOpen(false)}
          onComplete={() => {
            setOpen(false)
            setIsDue(false)
          }}
        />
      )}
    </>
  )
}
