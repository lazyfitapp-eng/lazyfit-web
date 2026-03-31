'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FoodLog {
  id: string
  food_name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  quantity: number
  meal_type: string
  logged_at: string
}

interface OFFProduct {
  id: string
  product_name: string
  brands?: string
  nutriments: {
    'energy-kcal_100g'?: number
    'energy-kcal'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
  }
  serving_size?: string
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = typeof MEAL_TYPES[number]

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '☀️',
  lunch: '🌤',
  dinner: '🌙',
  snack: '⚡',
}

function MacroBar({ current, target, color }: { current: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0
  return (
    <div className="h-1 rounded-full bg-[#111] overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

export default function FoodClient({
  userId,
  initialLogs,
  targets,
}: {
  userId: string
  initialLogs: FoodLog[]
  targets: { calories: number; protein: number; carbs: number; fat: number }
}) {
  const supabase = createClient()

  const [logs, setLogs] = useState<FoodLog[]>(initialLogs)
  const [activeMeal, setActiveMeal] = useState<MealType>('breakfast')
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OFFProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<OFFProduct | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [logging, setLogging] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const totals = logs.reduce(
    (acc, l) => ({
      calories: acc.calories + l.calories,
      protein: acc.protein + l.protein,
      carbs: acc.carbs + l.carbs,
      fat: acc.fat + l.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const searchOFF = async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=10&fields=id,product_name,brands,nutriments,serving_size`
      )
      const data = await res.json()
      const valid = (data.products ?? []).filter(
        (p: OFFProduct) => p.product_name && (p.nutriments['energy-kcal_100g'] ?? 0) > 0
      )
      setResults(valid.slice(0, 8))
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchOFF(val), 500)
  }

  const logFood = async () => {
    if (!selected) return
    setLogging(true)

    const qty = parseFloat(quantity) || 100
    const per100 = selected.nutriments
    const factor = qty / 100

    const entry = {
      user_id: userId,
      food_id: selected.id ?? `off-${Date.now()}`,
      food_name: selected.product_name,
      calories: Math.round((per100['energy-kcal_100g'] ?? 0) * factor),
      protein: Math.round((per100.proteins_100g ?? 0) * factor * 10) / 10,
      carbs: Math.round((per100.carbohydrates_100g ?? 0) * factor * 10) / 10,
      fat: Math.round((per100.fat_100g ?? 0) * factor * 10) / 10,
      quantity: qty,
      meal_type: activeMeal,
      logged_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from('food_logs').insert(entry).select().single()

    if (!error && data) {
      setLogs(prev => [...prev, data as FoodLog])
    }

    setSelected(null)
    setQuery('')
    setResults([])
    setQuantity('100')
    setShowSearch(false)
    setLogging(false)
  }

  const deleteLog = async (id: string) => {
    setDeleteId(id)
    await supabase.from('food_logs').delete().eq('id', id)
    setLogs(prev => prev.filter(l => l.id !== id))
    setDeleteId(null)
  }

  const logsByMeal = MEAL_TYPES.reduce((acc, m) => {
    acc[m] = logs.filter(l => l.meal_type === m)
    return acc
  }, {} as Record<MealType, FoodLog[]>)

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest text-muted-foreground">MODULE</p>
          <h2 className="text-xl font-bold tracking-widest text-white mt-0.5">FOOD</h2>
        </div>
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-2 px-4 py-2 border border-primary text-primary text-xs font-bold tracking-widest rounded hover:bg-primary hover:text-black transition-all"
        >
          + LOG FOOD
        </button>
      </div>

      {/* Daily summary */}
      <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-4 space-y-3">
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold text-white font-mono">{Math.round(totals.calories)}</span>
          <span className="text-xs text-muted-foreground mb-1">/ {targets.calories} kcal</span>
        </div>
        <MacroBar current={totals.calories} target={targets.calories} color={totals.calories > targets.calories ? '#FF0040' : '#00FF41'} />
        <div className="grid grid-cols-3 gap-3 pt-1">
          {[
            { label: 'PROTEIN', val: totals.protein, target: targets.protein, color: '#00FF41' },
            { label: 'CARBS', val: totals.carbs, target: targets.carbs, color: '#00CC33' },
            { label: 'FAT', val: totals.fat, target: targets.fat, color: '#FFAA00' },
          ].map(({ label, val, target, color }) => (
            <div key={label}>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-muted-foreground tracking-widest">{label}</span>
                <span className="text-white font-mono">{Math.round(val)}g</span>
              </div>
              <MacroBar current={val} target={target} color={color} />
            </div>
          ))}
        </div>
      </div>

      {/* Meal sections */}
      {MEAL_TYPES.map(meal => (
        <div key={meal}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs tracking-widest text-muted-foreground">
              {MEAL_ICONS[meal]} {meal.toUpperCase()}
            </p>
            <button
              onClick={() => { setActiveMeal(meal); setShowSearch(true) }}
              className="text-xs text-primary hover:underline tracking-widest"
            >
              + ADD
            </button>
          </div>

          {logsByMeal[meal].length > 0 ? (
            <div className="space-y-1">
              {logsByMeal[meal].map(log => (
                <div key={log.id} className="flex items-center justify-between bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-bold truncate">{log.food_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {log.quantity}g · P{Math.round(log.protein)}g · C{Math.round(log.carbs)}g · F{Math.round(log.fat)}g
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <span className="text-xs text-white font-mono">{Math.round(log.calories)} kcal</span>
                    <button
                      onClick={() => deleteLog(log.id)}
                      disabled={deleteId === log.id}
                      className="text-[#444] hover:text-[#FF0040] transition-colors text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#0a0a0a] border border-[#111] rounded-lg px-3 py-2.5">
              <p className="text-xs text-[#333] tracking-widest">Nothing logged yet</p>
            </div>
          )}
        </div>
      ))}

      {/* Search modal */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="border-b border-[#222] px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => { setShowSearch(false); setSelected(null); setQuery(''); setResults([]) }}
              className="text-muted-foreground hover:text-white transition-colors"
            >
              ←
            </button>
            <input
              type="text"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              autoFocus
              placeholder="Search food..."
              className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-[#444]"
            />
            {searching && <span className="text-xs text-muted-foreground">...</span>}
          </div>

          {/* Meal selector */}
          <div className="flex gap-2 px-4 py-3 border-b border-[#111]">
            {MEAL_TYPES.map(m => (
              <button
                key={m}
                onClick={() => setActiveMeal(m)}
                className={`px-3 py-1 text-xs rounded tracking-widest transition-all ${
                  activeMeal === m
                    ? 'bg-primary text-black font-bold'
                    : 'border border-[#333] text-muted-foreground hover:border-primary'
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Selected food — quantity + log */}
          {selected && (
            <div className="border-b border-[#222] px-4 py-4 bg-[#0a0a0a]">
              <p className="text-sm font-bold text-white mb-1">{selected.product_name}</p>
              {selected.brands && <p className="text-xs text-muted-foreground mb-3">{selected.brands}</p>}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] tracking-widest text-muted-foreground">QUANTITY (g)</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm text-white font-mono mt-1 focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="text-right">
                  {(() => {
                    const qty = parseFloat(quantity) || 100
                    const factor = qty / 100
                    const kcal = Math.round((selected.nutriments['energy-kcal_100g'] ?? 0) * factor)
                    const prot = Math.round((selected.nutriments.proteins_100g ?? 0) * factor * 10) / 10
                    return (
                      <div>
                        <p className="text-lg font-bold text-primary font-mono">{kcal} kcal</p>
                        <p className="text-[10px] text-muted-foreground font-mono">P{prot}g</p>
                      </div>
                    )
                  })()}
                </div>
              </div>
              <button
                onClick={logFood}
                disabled={logging}
                className="w-full mt-3 py-3 bg-primary text-black font-bold tracking-widest text-sm rounded hover:bg-[#00CC33] transition-colors disabled:opacity-40"
              >
                {logging ? 'LOGGING...' : `LOG TO ${activeMeal.toUpperCase()}`}
              </button>
            </div>
          )}

          {/* Search results */}
          <div className="flex-1 overflow-y-auto">
            {results.length > 0 ? (
              results.map(product => {
                const kcal = Math.round(product.nutriments['energy-kcal_100g'] ?? 0)
                const prot = Math.round((product.nutriments.proteins_100g ?? 0) * 10) / 10
                return (
                  <button
                    key={product.id}
                    onClick={() => setSelected(product)}
                    className={`w-full flex items-center justify-between px-4 py-3 border-b border-[#111] hover:bg-[#0a0a0a] transition-colors text-left ${
                      selected?.id === product.id ? 'bg-[#0a0a0a] border-l-2 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-bold truncate">{product.product_name}</p>
                      {product.brands && (
                        <p className="text-xs text-muted-foreground truncate">{product.brands}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm text-primary font-mono font-bold">{kcal}</p>
                      <p className="text-[10px] text-muted-foreground">kcal/100g</p>
                      <p className="text-[10px] text-muted-foreground font-mono">P{prot}g</p>
                    </div>
                  </button>
                )
              })
            ) : query && !searching ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-muted-foreground">No results for &quot;{query}&quot;</p>
              </div>
            ) : !query ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-muted-foreground tracking-widest">TYPE TO SEARCH</p>
                <p className="text-xs text-[#333] mt-2">Powered by Open Food Facts</p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
