'use client'

import { useRef } from 'react'

export default function DashboardDatePicker({
  dateStr,
  label,
  onDateChange,
}: {
  dateStr: string
  label: string
  onDateChange: (date: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative">
      <button
        onClick={() => inputRef.current?.showPicker()}
        className="flex items-center gap-1 text-xl font-bold text-white tracking-tight hover:text-[#ddd] transition-colors"
      >
        {label}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mt-0.5 text-white">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <input
        ref={inputRef}
        type="date"
        value={dateStr}
        onChange={e => { if (e.target.value) onDateChange(e.target.value) }}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        style={{ colorScheme: 'dark' }}
      />
    </div>
  )
}
