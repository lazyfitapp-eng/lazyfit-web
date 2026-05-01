'use client'

import { useState, useEffect } from 'react'
import WeeklyCheckin, { WeeklyCheckinBanner } from './WeeklyCheckin'

const CHECKIN_KEY = 'lf_checkin_week'

function getWeekNumber() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
}

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
}

export default function WeeklyCheckinWrapper(props: Props) {
  const [isDue, setIsDue] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(CHECKIN_KEY)
    const currentWeek = getWeekNumber()
    if (!saved || parseInt(saved, 10) < currentWeek) {
      setIsDue(true)
    }
  }, [])

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
