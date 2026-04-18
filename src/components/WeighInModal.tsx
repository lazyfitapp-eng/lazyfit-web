'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function calculateTrendWeight(current: number, recentWeights: number[]): number {
  const alpha = 2 / (7 + 1)
  const weights = [current, ...recentWeights.slice(0, 6)]
  let trend = weights[weights.length - 1]
  for (let i = weights.length - 2; i >= 0; i--) {
    trend = alpha * weights[i] + (1 - alpha) * trend
  }
  return Math.round(trend * 10) / 10
}

interface Props {
  userId: string
  recentWeights: number[]
  onSave: (weight: number, trendWeight: number) => void
  onClose: () => void
}

export default function WeighInModal({ userId, recentWeights, onSave, onClose }: Props) {
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleSave = async () => {
    const weight = parseFloat(input)
    if (!weight || weight < 20 || weight > 300) {
      setError('Enter a valid weight (20–300 kg)')
      return
    }
    setError(null)
    setSaving(true)

    const trendWeight = calculateTrendWeight(weight, recentWeights)
    const today = new Date().toISOString().split('T')[0]

    const { error: dbError } = await supabase
      .from('weight_entries')
      .upsert({ user_id: userId, weight, trend_weight: trendWeight, date: today }, { onConflict: 'user_id,date' })

    if (dbError) {
      setError(dbError.message)
      setSaving(false)
      return
    }

    await supabase.from('profiles').update({ current_weight: weight }).eq('id', userId)

    onSave(weight, trendWeight)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full bg-[#0d0d0d] border-t border-[#1a1a1a] rounded-t-2xl pb-safe">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 bg-[#222] rounded-full" />
        </div>

        <div className="px-5 pb-8 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white">Log Weight</h2>
            <p className="text-xs text-[#444] mt-0.5">Today&apos;s morning weight</p>
          </div>

          {/* Large input */}
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
              placeholder="82.5"
              className="w-full bg-[#111] border border-[#333] rounded-xl px-5 py-5 text-3xl text-white font-mono font-bold focus:outline-none focus:border-primary transition-colors pr-16 text-center"
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-base text-[#444] font-mono">kg</span>
          </div>

          {error && <p className="text-xs text-[#FF0040] text-center">{error}</p>}

          {/* Confirm button */}
          <button
            onClick={handleSave}
            disabled={saving || !input}
            className="w-full py-4 bg-primary text-black font-bold tracking-widest text-sm rounded-xl hover:bg-[#00CC33] transition-colors disabled:opacity-40"
          >
            {saving ? 'SAVING...' : 'SAVE'}
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-[#444] text-xs tracking-widest hover:text-[#666] transition-colors"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}
