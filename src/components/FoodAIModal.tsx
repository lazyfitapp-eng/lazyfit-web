'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FoodAIItem } from '@/app/api/food-ai/route'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = typeof MEAL_TYPES[number]

type Tab = 'camera' | 'text'

interface FoodAIModalProps {
  userId: string
  initialMealType: MealType
  onLogged: (items: LoggedItem[]) => void
  onClose: () => void
  onOpenManual: () => void
}

interface LoggedItem extends FoodAIItem {
  id: string
}

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => res(reader.result as string)
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

export default function FoodAIModal({
  userId,
  initialMealType,
  onLogged,
  onClose,
  onOpenManual,
}: FoodAIModalProps) {
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('camera')
  const [mealType, setMealType] = useState<MealType>(initialMealType)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageData, setImageData] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<LoggedItem[] | null>(null)
  const [logging, setLogging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await toBase64(file)
    setImagePreview(b64)
    setImageData(b64)
    setError(null)
  }

  const handleAnalyse = async () => {
    if (!imageData && !text.trim()) {
      setError('Take a photo or describe your meal first.')
      return
    }
    setAnalysing(true)
    setError(null)
    try {
      const res = await fetch('/api/food-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageData ?? undefined,
          text: text.trim() || undefined,
          meal_type: mealType,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.items) {
        setError(data.error ?? `Analysis failed (${res.status}). Try again.`)
        return
      }
      setItems(data.items.map((item: FoodAIItem, i: number) => ({ ...item, id: `ai-${i}-${Date.now()}` })))
    } catch {
      setError('Network error. Try again.')
    } finally {
      setAnalysing(false)
    }
  }

  const updateItem = (id: string, field: keyof FoodAIItem, value: string | number) => {
    setItems(prev => prev?.map(item =>
      item.id === id ? { ...item, [field]: typeof value === 'string' && field !== 'name' && field !== 'confidence'
        ? parseFloat(value) || 0
        : value } : item
    ) ?? null)
  }

  const removeItem = (id: string) => {
    setItems(prev => {
      const next = prev?.filter(i => i.id !== id) ?? null
      return next?.length === 0 ? null : next
    })
  }

  const handleLogAll = async () => {
    if (!items?.length) return
    setLogging(true)
    try {
      const rows = items.map(item => ({
        user_id: userId,
        food_id: `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        food_name: item.name,
        calories: Math.round(item.calories),
        protein: Math.round(item.protein * 10) / 10,
        carbs: Math.round(item.carbs * 10) / 10,
        fat: Math.round(item.fat * 10) / 10,
        quantity: item.quantity_g,
        meal_type: mealType,
        logged_at: new Date().toISOString(),
      }))
      const { data, error: dbErr } = await supabase.from('food_logs').insert(rows).select()
      if (dbErr) throw dbErr
      onLogged(data as LoggedItem[])
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      setError(`Failed to log food: ${msg}`)
    } finally {
      setLogging(false)
    }
  }

  const resetToInput = () => {
    setItems(null)
    setError(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] flex-shrink-0">
        <button onClick={onClose} className="text-[#555] hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white tracking-wide">AI Food Log</span>
        <button
          onClick={onOpenManual}
          className="text-[10px] text-[#555] hover:text-[#aaa] tracking-widest transition-colors"
        >
          MANUAL
        </button>
      </div>

      {/* Meal type selector */}
      <div className="flex gap-2 px-4 py-3 border-b border-[#111] flex-shrink-0">
        {MEAL_TYPES.map(m => (
          <button
            key={m}
            onClick={() => setMealType(m)}
            className={`px-3 py-1 text-[10px] rounded-full tracking-widest transition-all ${
              mealType === m
                ? 'bg-primary text-black font-bold'
                : 'border border-[#222] text-[#555] hover:border-[#444]'
            }`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      {analysing ? (
        /* Loading */
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#666] font-mono tracking-widest">ANALYSING YOUR MEAL...</p>
        </div>
      ) : items ? (
        /* Results */
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {items.map(item => (
              <div key={item.id} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => updateItem(item.id, 'name', e.target.value)}
                    className="flex-1 bg-transparent text-white text-sm font-semibold focus:outline-none border-b border-[#222] focus:border-primary pb-0.5"
                  />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.confidence === 'low' && (
                      <span className="text-[10px] text-[#FFAA00]" title="Low confidence">⚠</span>
                    )}
                    <button onClick={() => removeItem(item.id)} className="text-[#333] hover:text-[#FF0040] transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Editable macro row */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'KCAL', field: 'calories' as keyof FoodAIItem, color: '#aaa', unit: '' },
                    { label: 'P', field: 'protein' as keyof FoodAIItem, color: '#00FF41', unit: 'g' },
                    { label: 'C', field: 'carbs' as keyof FoodAIItem, color: '#00CC33', unit: 'g' },
                    { label: 'F', field: 'fat' as keyof FoodAIItem, color: '#FFAA00', unit: 'g' },
                  ].map(({ label, field, color, unit }) => (
                    <div key={field} className="flex flex-col items-center">
                      <span className="text-[9px] tracking-widest mb-1" style={{ color }}>{label}</span>
                      <input
                        type="number"
                        value={Math.round((item[field] as number) * 10) / 10}
                        onChange={e => updateItem(item.id, field, e.target.value)}
                        className="w-full bg-[#111] border border-[#222] rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-primary"
                      />
                      {unit && <span className="text-[9px] text-[#333] mt-0.5">{unit}</span>}
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-[#444] tracking-widest">QTY</span>
                  <input
                    type="number"
                    value={item.quantity_g}
                    onChange={e => updateItem(item.id, 'quantity_g', e.target.value)}
                    className="w-20 bg-[#111] border border-[#222] rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-primary"
                  />
                  <span className="text-[10px] text-[#444]">g</span>
                </div>
              </div>
            ))}

            {error && (
              <p className="text-xs text-[#FF0040] text-center py-2">{error}</p>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-4 py-4 border-t border-[#111] flex-shrink-0 space-y-2">
            <button
              onClick={handleLogAll}
              disabled={logging || !items.length}
              className="w-full py-3 bg-primary text-black font-bold tracking-widest text-sm rounded-xl hover:bg-[#00CC33] transition-colors disabled:opacity-40"
            >
              {logging ? 'LOGGING...' : `LOG ${items.length} ITEM${items.length !== 1 ? 'S' : ''} TO ${mealType.toUpperCase()}`}
            </button>
            <button
              onClick={resetToInput}
              className="w-full py-2 text-xs text-[#444] hover:text-[#666] tracking-widest transition-colors"
            >
              RETAKE / EDIT
            </button>
          </div>
        </div>
      ) : (
        /* Input — Camera / Text tabs */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Tab bar */}
          <div className="flex px-4 pt-4 gap-3 flex-shrink-0">
            {(['camera', 'text'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-2 text-xs tracking-widest border-b-2 transition-all ${
                  tab === t ? 'border-primary text-white' : 'border-transparent text-[#444]'
                }`}
              >
                {t === 'camera' ? '📷 CAMERA' : '✏️ TEXT'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {tab === 'camera' ? (
              <>
                {imagePreview ? (
                  <div className="relative rounded-xl overflow-hidden bg-[#0d0d0d]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Food preview" className="w-full max-h-64 object-cover" />
                    <button
                      onClick={() => { setImagePreview(null); setImageData(null) }}
                      className="absolute top-2 right-2 bg-black/70 rounded-full p-1.5 text-[#aaa] hover:text-white"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed border-[#222] rounded-xl flex flex-col items-center justify-center gap-3 hover:border-[#444] transition-colors"
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span className="text-xs text-[#444] tracking-widest">TAP TO TAKE PHOTO</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleImageCapture}
                />
                <div>
                  <label className="text-[10px] text-[#444] tracking-widest block mb-2">DESCRIPTION (OPTIONAL)</label>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="e.g. 200g chicken breast with rice and salad"
                    rows={2}
                    className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl px-3 py-2 text-sm text-white placeholder-[#333] focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="text-[10px] text-[#444] tracking-widest block mb-2">DESCRIBE YOUR MEAL</label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="e.g. 200g chicken breast, 150g rice, 100g broccoli"
                  rows={5}
                  autoFocus
                  className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl px-3 py-3 text-sm text-white placeholder-[#333] focus:outline-none focus:border-primary resize-none"
                />
                <p className="text-[10px] text-[#333] mt-2">
                  Be specific about quantities for accurate macros.
                </p>
              </div>
            )}

            {error && (
              <p className="text-xs text-[#FF0040] text-center">{error}</p>
            )}
          </div>

          <div className="px-4 py-4 border-t border-[#111] flex-shrink-0">
            <button
              onClick={handleAnalyse}
              disabled={analysing}
              className="w-full py-3 bg-primary text-black font-bold tracking-widest text-sm rounded-xl hover:bg-[#00CC33] transition-colors disabled:opacity-40"
            >
              ANALYSE
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
