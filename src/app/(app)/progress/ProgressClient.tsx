'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface WeightEntry {
  id: string
  weight: number
  trend_weight: number
  date: string
}

function calculateTrendWeight(current: number, recent: WeightEntry[]): number {
  const alpha = 2 / (7 + 1)
  const weights = [current, ...recent.slice(0, 6).map(e => e.weight)]
  let trend = weights[weights.length - 1]
  for (let i = weights.length - 2; i >= 0; i--) {
    trend = alpha * weights[i] + (1 - alpha) * trend
  }
  return Math.round(trend * 10) / 10
}

export default function ProgressClient({
  userId,
  initialEntries,
  goal,
  currentWeight,
}: {
  userId: string
  initialEntries: WeightEntry[]
  goal: string
  currentWeight: number | null
}) {
  const supabase = createClient()
  const [entries, setEntries] = useState<WeightEntry[]>(initialEntries)
  const [weightInput, setWeightInput] = useState(
    currentWeight ? String(currentWeight) : ''
  )
  const [logging, setLogging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const alreadyLoggedToday = entries.some(e => e.date === today)

  const logWeight = async () => {
    const weight = parseFloat(weightInput)
    if (!weight || weight < 20 || weight > 300) {
      setError('Enter a valid weight (20–300 kg)')
      return
    }
    setError(null)
    setLogging(true)

    const trendWeight = calculateTrendWeight(weight, entries)

    // Upsert (in case they're updating today's entry)
    const { data, error: dbError } = await supabase
      .from('weight_entries')
      .upsert({
        user_id: userId,
        weight,
        trend_weight: trendWeight,
        date: today,
      }, { onConflict: 'user_id,date' })
      .select('id, weight, trend_weight, date')
      .single()

    if (dbError) {
      setError(dbError.message)
      setLogging(false)
      return
    }

    // Also update profile current_weight
    await supabase.from('profiles').update({ current_weight: weight }).eq('id', userId)

    setEntries(prev => {
      const withoutToday = prev.filter(e => e.date !== today)
      return [data as WeightEntry, ...withoutToday].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    })
    setLogging(false)
  }

  const latest = entries[0]
  const oldest = entries[entries.length - 1]
  const totalChange = latest && oldest && latest.date !== oldest.date
    ? Math.round((latest.weight - oldest.weight) * 10) / 10
    : null

  // Weekly change (last 7 vs prior 7 entries)
  const weeklyChange = entries.length >= 7
    ? Math.round((
        entries.slice(0, 7).reduce((s, e) => s + e.weight, 0) / 7 -
        (entries.length >= 14
          ? entries.slice(7, 14).reduce((s, e) => s + e.weight, 0) / 7
          : entries.slice(0, 7).reduce((s, e) => s + e.weight, 0) / 7)
      ) * 10) / 10
    : null

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-widest text-muted-foreground">MODULE</p>
        <h2 className="text-xl font-bold tracking-widest text-white mt-0.5">PROGRESS</h2>
      </div>

      {/* Log weight */}
      <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-4">
        <p className="text-xs tracking-widest text-muted-foreground mb-3">
          {alreadyLoggedToday ? 'UPDATE TODAY\'S WEIGHT' : 'LOG WEIGHT'}
        </p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="decimal"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              placeholder="e.g. 82.4"
              className="w-full bg-[#111] border border-[#333] rounded px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-primary transition-colors pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
          </div>
          <button
            onClick={logWeight}
            disabled={logging}
            className="px-5 py-3 border border-primary text-primary text-xs font-bold tracking-widest rounded hover:bg-primary hover:text-black transition-all disabled:opacity-40"
          >
            {logging ? '...' : 'LOG'}
          </button>
        </div>
        {error && <p className="text-xs text-[#FF0040] mt-2">{error}</p>}
      </div>

      {/* Stats row */}
      {latest && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-4">
            <p className="text-xs tracking-widest text-muted-foreground mb-1">CURRENT</p>
            <p className="text-2xl font-bold text-white font-mono">{latest.weight}<span className="text-sm text-muted-foreground ml-1">kg</span></p>
          </div>
          <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-4">
            <p className="text-xs tracking-widest text-muted-foreground mb-1">TREND</p>
            <p className="text-2xl font-bold text-primary font-mono">{latest.trend_weight}<span className="text-sm text-primary/60 ml-1">kg</span></p>
          </div>
          {weeklyChange !== null && (
            <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-4">
              <p className="text-xs tracking-widest text-muted-foreground mb-1">THIS WEEK</p>
              <p className={`text-2xl font-bold font-mono ${
                weeklyChange < -0.1 ? 'text-primary' :
                weeklyChange > 0.1 ? 'text-[#FF0040]' :
                'text-[#aaa]'
              }`}>
                {weeklyChange > 0 ? '+' : ''}{weeklyChange}<span className="text-sm ml-1 opacity-60">kg</span>
              </p>
            </div>
          )}
          {totalChange !== null && (
            <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-4">
              <p className="text-xs tracking-widest text-muted-foreground mb-1">TOTAL ({entries.length}d)</p>
              <p className={`text-2xl font-bold font-mono ${
                totalChange < 0 ? 'text-primary' :
                totalChange > 0 ? 'text-[#FF0040]' :
                'text-[#aaa]'
              }`}>
                {totalChange > 0 ? '+' : ''}{totalChange}<span className="text-sm ml-1 opacity-60">kg</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {entries.length > 0 ? (
        <div className="bg-[#0a0a0a] border border-[#222] rounded-lg overflow-hidden">
          <div className="grid grid-cols-3 px-4 py-2 border-b border-[#222]">
            <span className="text-[10px] tracking-widest text-muted-foreground">DATE</span>
            <span className="text-[10px] tracking-widest text-muted-foreground">WEIGHT</span>
            <span className="text-[10px] tracking-widest text-muted-foreground">TREND</span>
          </div>
          {entries.slice(0, 20).map((e) => (
            <div key={e.id} className={`grid grid-cols-3 px-4 py-2.5 border-b border-[#0f0f0f] last:border-0 ${e.date === today ? 'bg-primary/5' : ''}`}>
              <span className="text-xs text-muted-foreground font-mono">{e.date}</span>
              <span className="text-xs text-white font-mono">{e.weight} kg</span>
              <span className="text-xs text-primary font-mono">{e.trend_weight} kg</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-8 text-center">
          <p className="text-xs tracking-widest text-primary mb-3">NO DATA YET</p>
          <p className="text-muted-foreground text-sm">Log your weight above to start tracking your trend.</p>
        </div>
      )}
    </div>
  )
}
