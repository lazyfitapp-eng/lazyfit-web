'use client'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface WeekStripProps {
  today: string
  selected: string
  activityByDate: Record<string, { food: boolean; workout: boolean }>
  onDateClick?: (date: string) => void
}

// Two 4×4 dots: #3ecf8e = trained, #2a6e50 = food logged
function ActivityDots({ hasFood, hasWorkout }: { hasFood: boolean; hasWorkout: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '2px', height: '5px', alignItems: 'center' }}>
      {hasWorkout && (
        <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#3ecf8e' }} />
      )}
      {hasFood && (
        <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#2a6e50' }} />
      )}
    </div>
  )
}

export default function WeekStrip({
  today,
  selected,
  activityByDate,
  onDateClick,
}: WeekStripProps) {
  const days: { date: string; num: number; letter: string }[] = []
  const [ty, tm, td] = today.split('-').map(Number)

  for (let i = -7; i <= 6; i++) {
    const d = new Date(Date.UTC(ty, tm - 1, td + i))
    const dateStr = d.toISOString().split('T')[0]
    days.push({ date: dateStr, num: d.getUTCDate(), letter: DAY_LETTERS[d.getUTCDay()] })
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
      {days.map(({ date, num, letter }) => {
        const isToday = date === today
        const isSelected = date === selected
        const isPast = date < today
        const activity = activityByDate[date] ?? { food: false, workout: false }

        return (
          <button
            key={date}
            onClick={() => onDateClick?.(date)}
            className="flex flex-col items-center gap-1 flex-shrink-0 w-9 active:opacity-70 transition-opacity font-ui"
          >
            <span className="text-[9px] text-[#383838] uppercase tracking-[0.3px]">{letter}</span>

            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                isSelected && isToday
                  ? 'bg-[#3ecf8e]'
                  : isSelected
                  ? 'border border-[#555] bg-[#111]'
                  : isToday
                  ? 'border border-[#3ecf8e]/40'
                  : 'border border-transparent'
              }`}
            >
              <span
                className={`text-[13px] font-medium leading-none font-mono ${
                  isSelected && isToday ? 'text-[#0a0a0a] font-bold'
                  : isSelected ? 'text-white font-bold'
                  : isToday ? 'text-[#3ecf8e]'
                  : isPast ? 'text-[#555]'
                  : 'text-[#555]'
                }`}
              >
                {num}
              </span>
            </div>

            <ActivityDots hasFood={isToday ? false : activity.food} hasWorkout={isToday ? false : activity.workout} />
          </button>
        )
      })}
    </div>
  )
}
