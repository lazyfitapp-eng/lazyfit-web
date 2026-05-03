'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { detectFoodAmbiguity, type FoodAmbiguityIssue } from '@/lib/foodAmbiguity'
import { addLocalDays, getLocalDateString, parseLocalDateString } from '@/lib/dateUtils'
import type { USDAResult } from '@/app/api/food-search/route'
import type { FoodAIItem } from '@/app/api/food-ai/route'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FoodLog {
  id: string
  food_name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  quantity: number
  meal_type: string
  logged_at: string
}

interface EditableAIItem extends FoodAIItem {
  _id: string
}

interface EditLogForm {
  food_name: string
  quantity: string
  unit: string
  calories: string
  protein: string
  carbs: string
  fat: string
  meal_type: MealType
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
type SummaryMode = 'logged' | 'remaining'
type MethodTab = 'photo' | 'voice' | 'search' | 'barcode'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

const MEAL_CONFIG: Record<MealType, { color: string; label: string }> = {
  breakfast: { color: '#4a9eff', label: 'Breakfast' },
  lunch:     { color: '#3ecf8e', label: 'Lunch' },
  dinner:    { color: '#f5a623', label: 'Dinner' },
  snack:     { color: '#b66dff', label: 'Snack' },
}

const CIRC = 295.2 // 2π × 47

const METHOD_TABS: { id: MethodTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'photo', label: 'Photo',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  },
  {
    id: 'voice', label: 'Voice',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>,
  },
  {
    id: 'search', label: 'Search',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  },
  {
    id: 'barcode', label: 'Barcode',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="4" width="3" height="16"/><rect x="6" y="4" width="1" height="16"/><rect x="9" y="4" width="2" height="16"/><rect x="13" y="4" width="1" height="16"/><rect x="16" y="4" width="3" height="16"/><rect x="21" y="4" width="2" height="16"/></svg>,
  },
]

const VOICE_EXAMPLE = '200g grilled chicken breast, 250g white rice cooked, 1 tablespoon olive oil, mixed salad with balsamic dressing'

// ─────────────────────────────────────────────────────────────────────────────
// Helper: toBase64
// ─────────────────────────────────────────────────────────────────────────────

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => res(reader.result as string)
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

function timestampForSelectedDate(date: string): string {
  const now = new Date()
  const selected = parseLocalDateString(date) ?? now
  selected.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())
  return selected.toISOString()
}

function parsePositiveQuantity(value: string | number): number | null {
  if (typeof value === 'string' && value.trim() === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseNonNegativeNumber(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

// ─────────────────────────────────────────────────────────────────────────────
// DayNote sub-component
// ─────────────────────────────────────────────────────────────────────────────

function DayNote({ userId, date, initialNote }: { userId: string; date: string; initialNote: string }) {
  const supabase = createClient()
  const [note, setNote] = useState(initialNote)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setNote(initialNote)
    setSaving(false)
  }, [date, initialNote])

  const handleBlur = async () => {
    setSaving(true)
    await supabase
      .from('day_notes')
      .upsert({ user_id: userId, date, note }, { onConflict: 'user_id,date' })
    setSaving(false)
  }

  return (
    <div style={{ background: '#121212', border: '1px solid #242424', borderRadius: 20, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {/* pencil icon */}
      <div style={{ width: 28, height: 28, background: '#181818', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b8b8b8" strokeWidth="1.8" strokeLinecap="round">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#b8b8b8', marginBottom: 6 }}>
          Day Note{saving && <span style={{ marginLeft: 8, color: '#282828' }}>saving…</span>}
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={handleBlur}
          placeholder="How did today go?"
          rows={2}
          style={{ background: 'none', border: 'none', color: '#b8b8b8', fontSize: 13, fontFamily: 'inherit', width: '100%', outline: 'none', resize: 'none', lineHeight: 1.6, caretColor: '#3ecf8e' }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function FoodClient({
  userId,
  initialLogs,
  targets,
  date,
  initialMeal,
  dayNote,
}: {
  userId: string
  initialLogs: FoodLog[]
  targets: { calories: number; protein: number; carbs: number; fat: number }
  date: string
  initialMeal: MealType | null
  dayNote: string
}) {
  const supabase = createClient()
  const router = useRouter()

  // ── Core state ──────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<FoodLog[]>(initialLogs)
  const [mode, setMode] = useState<SummaryMode>('logged')

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(Boolean(initialMeal))
  const [modalMeal, setModalMeal] = useState<MealType>(initialMeal ?? 'breakfast')
  const [methodTab, setMethodTab] = useState<MethodTab>('photo')

  // ── Photo tab ───────────────────────────────────────────────────────────────
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageData, setImageData] = useState<string | null>(null)
  const [photoWeight, setPhotoWeight] = useState('')
  const [photoDesc, setPhotoDesc] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Voice tab ───────────────────────────────────────────────────────────────
  const [voiceText, setVoiceText] = useState('')
  const [micListening, setMicListening] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)

  // ── Search tab ──────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<USDAResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedResult, setSelectedResult] = useState<USDAResult | null>(null)
  const [selectedQty, setSelectedQty] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Barcode tab ─────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const [scannerActive, setScannerActive] = useState(false)
  const [scannedProduct, setScannedProduct] = useState<USDAResult | null>(null)
  const [scannedQty, setScannedQty] = useState('')
  const [barcodeError, setBarcodeError] = useState<string | null>(null)

  // ── AI items (shared photo + voice) ────────────────────────────────────────
  const [aiItems, setAiItems] = useState<EditableAIItem[] | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiWarnings, setAiWarnings] = useState<FoodAmbiguityIssue[]>([])

  // ── Action menu (···) ───────────────────────────────────────────────────────
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null)
  const [editForm, setEditForm] = useState<EditLogForm | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // ── CTA loading ─────────────────────────────────────────────────────────────
  const [ctaLoading, setCtaLoading] = useState(false)

  // ── Date helpers ────────────────────────────────────────────────────────────
  const today = useMemo(() => getLocalDateString(), [])
  const isToday = date === today

  const dateLabel = useMemo(() => {
    const d = new Date(date + 'T12:00:00')
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }, [date])

  function shiftDay(delta: number) {
    const next = addLocalDays(date, delta)
    setLogs([])
    setActionMenuId(null)
    router.push(next === today ? '/food' : `/food?date=${next}`)
  }

  useEffect(() => {
    setLogs(initialLogs)
    setActionMenuId(null)
    setEditingLog(null)
    setEditForm(null)
    setEditError(null)
  }, [date, initialLogs])

  useEffect(() => {
    if (initialMeal) {
      setModalMeal(initialMeal)
      setModalOpen(true)
    } else {
      setModalMeal('breakfast')
      setModalOpen(false)
    }
  }, [date, initialMeal])

  // ── FAB event listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => { setModalMeal('breakfast'); setModalOpen(true) }
    window.addEventListener('lazyfit:open-food-modal', handler)
    return () => window.removeEventListener('lazyfit:open-food-modal', handler)
  }, [])

  // ── Close action menu on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!actionMenuId) return
    const handler = () => setActionMenuId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [actionMenuId])

  // ── Stop barcode scanner when modal closes ──────────────────────────────────
  const stopScanner = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setScannerActive(false)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    stopScanner()
    // reset modal state after transition
    setTimeout(() => {
      setMethodTab('photo')
      setImagePreview(null); setImageData(null); setPhotoWeight(''); setPhotoDesc('')
      setVoiceText(''); setMicListening(false); setMicError(null)
      setSearchQuery(''); setSearchResults([]); setSelectedResult(null); setSelectedQty(''); setSearchError(null)
      setScannedProduct(null); setScannedQty(''); setBarcodeError(null)
      setAiItems(null); setAiError(null); setAiWarnings([])
      setCtaLoading(false)
    }, 300)
  }, [stopScanner])

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totals = useMemo(() => logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories ?? 0),
      protein:  acc.protein  + (l.protein  ?? 0),
      carbs:    acc.carbs    + (l.carbs    ?? 0),
      fat:      acc.fat      + (l.fat      ?? 0),
      fiber:    acc.fiber    + (l.fiber    ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  ), [logs])

  const remaining = useMemo(() => ({
    calories: targets.calories - Math.round(totals.calories),
    protein:  targets.protein  - Math.round(totals.protein),
    carbs:    targets.carbs    - Math.round(totals.carbs),
    fat:      targets.fat      - Math.round(totals.fat),
  }), [totals, targets])

  const logsByMeal = useMemo(() => MEAL_TYPES.reduce((acc, m) => {
    acc[m] = logs.filter(l => l.meal_type === m)
    return acc
  }, {} as Record<MealType, FoodLog[]>), [logs])

  // ── Ring ────────────────────────────────────────────────────────────────────
  const loggedArc = targets.calories > 0 ? Math.min(totals.calories / targets.calories, 1) * CIRC : 0
  const remainingArc = targets.calories > 0 ? Math.max(0, remaining.calories) / targets.calories * CIRC : 0
  const arcDash = mode === 'logged' ? loggedArc : remainingArc
  const ringColor = mode === 'logged' ? '#3ecf8e' : '#f5a623'
  const ringNum = mode === 'logged' ? Math.round(totals.calories) : Math.max(0, remaining.calories)
  const ringUnit = mode === 'logged' ? 'logged' : remaining.calories >= 0 ? 'remaining' : 'over'
  const ringCtx = `of ${targets.calories}`

  // ── Macros bar config ───────────────────────────────────────────────────────
  const macros = useMemo(() => [
    { key: 'protein', label: 'Prot', color: '#4a9eff', consumed: totals.protein, target: targets.protein },
    { key: 'carbs',   label: 'Carbs', color: '#3ecf8e', consumed: totals.carbs,   target: targets.carbs },
    { key: 'fat',     label: 'Fat',   color: '#f5a623', consumed: totals.fat,     target: targets.fat },
  ], [totals, targets])

  // ── Delete food log ─────────────────────────────────────────────────────────
  const deleteLog = async (id: string) => {
    setActionMenuId(null)
    const { error } = await supabase.from('food_logs').delete().eq('id', id)
    if (error) {
      alert(`Delete failed: ${error.message}`)
    } else {
      setLogs(prev => prev.filter(l => l.id !== id))
      if (editingLog?.id === id) closeEditSheet()
    }
  }

  // ── Open modal for a specific meal ──────────────────────────────────────────
  const openEditSheet = (log: FoodLog) => {
    setActionMenuId(null)
    setEditingLog(log)
    setEditForm({
      food_name: log.food_name,
      quantity: String(log.quantity ?? ''),
      unit: 'g',
      calories: String(Math.round((log.calories ?? 0) * 10) / 10),
      protein: String(Math.round((log.protein ?? 0) * 10) / 10),
      carbs: String(Math.round((log.carbs ?? 0) * 10) / 10),
      fat: String(Math.round((log.fat ?? 0) * 10) / 10),
      meal_type: MEAL_TYPES.includes(log.meal_type as MealType) ? log.meal_type as MealType : 'breakfast',
    })
    setEditError(null)
  }

  const closeEditSheet = () => {
    setEditingLog(null)
    setEditForm(null)
    setEditSaving(false)
    setEditError(null)
  }

  const updateEditForm = (field: keyof EditLogForm, value: string | MealType) => {
    setEditForm(prev => prev ? { ...prev, [field]: value } : prev)
    setEditError(null)
  }

  const saveEditedLog = async () => {
    if (!editingLog || !editForm || editSaving) return
    const foodName = editForm.food_name.trim()
    const quantity = parsePositiveQuantity(editForm.quantity)
    const calories = parseNonNegativeNumber(editForm.calories)
    const protein = parseNonNegativeNumber(editForm.protein)
    const carbs = parseNonNegativeNumber(editForm.carbs)
    const fat = parseNonNegativeNumber(editForm.fat)

    if (!foodName) { setEditError('Enter a food name.'); return }
    if (quantity === null) { setEditError('Enter a valid quantity greater than 0.'); return }
    if (calories === null || protein === null || carbs === null || fat === null) {
      setEditError('Calories and macros must be 0 or higher.')
      return
    }

    setEditSaving(true)
    setEditError(null)
    const updates = {
      food_name: foodName,
      quantity,
      calories: Math.round(calories),
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fat: Math.round(fat * 10) / 10,
      meal_type: editForm.meal_type,
    }

    const { data, error } = await supabase
      .from('food_logs')
      .update(updates)
      .eq('id', editingLog.id)
      .eq('user_id', userId)
      .select('id, food_name, calories, protein, carbs, fat, fiber, quantity, meal_type, logged_at')
      .single()

    if (error) {
      setEditError(`Save failed: ${error.message}`)
      setEditSaving(false)
      return
    }

    const updatedLog = data as FoodLog
    setLogs(prev => prev.map(log => log.id === updatedLog.id ? updatedLog : log))
    closeEditSheet()
  }

  const openModal = (meal: MealType) => {
    setModalMeal(meal)
    setModalOpen(true)
  }

  // ── USDA search ─────────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setSearchError(null); return }
    setSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(`/api/food-search?q=${encodeURIComponent(q)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSearchError(res.status === 401 ? 'Session expired — please refresh the page.' : (err.error ?? `Search failed (${res.status})`))
        setSearchResults([])
        return
      }
      const data = await res.json()
      setSearchResults(data.results ?? [])
    } catch {
      setSearchError('Network error — check your connection.')
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setSelectedResult(null)
    setSearchError(null)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => runSearch(val), 500)
  }

  // ── Analyse (photo + voice) ─────────────────────────────────────────────────
  const handleAnalyse = async () => {
    const descriptionText = methodTab === 'photo' ? photoDesc.trim() : voiceText.trim()
    const analysisText = methodTab === 'photo'
      ? [photoWeight && `Total meal weight: ${photoWeight}g`, photoDesc].filter(Boolean).join('. ')
      : voiceText.trim()

    if (!imageData && !descriptionText) {
      setAiError(methodTab === 'photo' ? 'Take a photo or add a description first.' : 'Describe your meal first.')
      return
    }

    const ambiguityIssues = detectFoodAmbiguity(analysisText)
    const blockingIssue = ambiguityIssues.find(issue => issue.blocking)
    if (blockingIssue) {
      setAiWarnings([])
      setAiError(blockingIssue.message)
      return
    }
    setAiWarnings(ambiguityIssues)
    setAnalysing(true); setAiError(null); setCtaLoading(true)
    try {
      const res = await fetch('/api/food-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageData ?? undefined,
          text: analysisText || undefined,
          meal_type: modalMeal,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.items) { setAiError(data.error ?? 'Analysis failed. Try again.'); return }
      setAiItems(data.items.map((item: FoodAIItem, i: number) => ({ ...item, _id: `ai-${i}-${Date.now()}` })))
    } catch {
      setAiError('Network error. Try again.')
    } finally {
      setAnalysing(false); setCtaLoading(false)
    }
  }

  const updateAiItem = (id: string, field: keyof FoodAIItem, value: string | number) => {
    setAiItems(prev => prev?.map(item =>
      item._id === id
        ? { ...item, [field]: typeof value === 'string' && field !== 'name' && field !== 'confidence' ? parseFloat(value) || 0 : value }
        : item
    ) ?? null)
  }

  const removeAiItem = (id: string) => {
    setAiItems(prev => {
      const next = prev?.filter(i => i._id !== id) ?? null
      return next?.length === 0 ? null : next
    })
  }

  // ── Log AI items ────────────────────────────────────────────────────────────
  const handleLogAiItems = async () => {
    if (!aiItems?.length) return
    const blockingWarning = aiWarnings.find(issue => issue.blocking)
    if (blockingWarning) {
      setAiError(blockingWarning.message)
      return
    }
    setCtaLoading(true)
    try {
      const invalidItem = aiItems.find(item => parsePositiveQuantity(item.quantity_g) === null)
      if (invalidItem) {
        setAiError('Enter a valid quantity greater than 0g for every item.')
        return
      }
      setAiError(null)
      const loggedAt = timestampForSelectedDate(date)
      const rows = aiItems.map(item => ({
        user_id: userId,
        food_id: `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        food_name: item.name,
        calories: Math.round(item.calories),
        protein: Math.round(item.protein * 10) / 10,
        carbs: Math.round(item.carbs * 10) / 10,
        fat: Math.round(item.fat * 10) / 10,
        quantity: parsePositiveQuantity(item.quantity_g) as number,
        meal_type: modalMeal,
        logged_at: loggedAt,
      }))
      const { data, error } = await supabase.from('food_logs').insert(rows).select()
      if (error) throw new Error(error.message)
      setLogs(prev => [...prev, ...(data as FoodLog[])])
      closeModal()
    } catch (err) {
      setAiError(`Failed to log: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCtaLoading(false)
    }
  }

  // ── Log USDA search result ──────────────────────────────────────────────────
  const handleLogSearchResult = async () => {
    if (!selectedResult) return
    setCtaLoading(true)
    try {
      const qty = parsePositiveQuantity(selectedQty)
      if (qty === null) {
        setSearchError('Enter a valid quantity greater than 0g.')
        return
      }
      setSearchError(null)
      const factor = qty / 100
      const loggedAt = timestampForSelectedDate(date)
      const entry = {
        user_id: userId,
        food_id: `usda-${selectedResult.fdcId}`,
        food_name: selectedResult.name,
        calories: Math.round(selectedResult.kcalPer100g * factor),
        protein: Math.round(selectedResult.protein * factor * 10) / 10,
        carbs: Math.round(selectedResult.carbs * factor * 10) / 10,
        fat: Math.round(selectedResult.fat * factor * 10) / 10,
        fiber: Math.round((selectedResult.fiber ?? 0) * factor * 10) / 10,
        quantity: qty,
        meal_type: modalMeal,
        logged_at: loggedAt,
      }
      const { data, error } = await supabase.from('food_logs').insert(entry).select().single()
      if (error) throw new Error(error.message)
      setLogs(prev => [...prev, data as FoodLog])
      closeModal()
    } catch (err) {
      alert(`Log failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCtaLoading(false)
    }
  }

  // ── Log scanned barcode product ─────────────────────────────────────────────
  const handleLogScannedProduct = async () => {
    if (!scannedProduct) return
    setCtaLoading(true)
    try {
      const qty = parsePositiveQuantity(scannedQty)
      if (qty === null) {
        setBarcodeError('Enter a valid quantity greater than 0g.')
        return
      }
      setBarcodeError(null)
      const factor = qty / 100
      const loggedAt = timestampForSelectedDate(date)
      const entry = {
        user_id: userId,
        food_id: `usda-${scannedProduct.fdcId}`,
        food_name: scannedProduct.name,
        calories: Math.round(scannedProduct.kcalPer100g * factor),
        protein: Math.round(scannedProduct.protein * factor * 10) / 10,
        carbs: Math.round(scannedProduct.carbs * factor * 10) / 10,
        fat: Math.round(scannedProduct.fat * factor * 10) / 10,
        fiber: Math.round((scannedProduct.fiber ?? 0) * factor * 10) / 10,
        quantity: qty,
        meal_type: modalMeal,
        logged_at: loggedAt,
      }
      const { data, error } = await supabase.from('food_logs').insert(entry).select().single()
      if (error) throw new Error(error.message)
      setLogs(prev => [...prev, data as FoodLog])
      closeModal()
    } catch (err) {
      alert(`Log failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCtaLoading(false)
    }
  }

  // ── Barcode scanner ─────────────────────────────────────────────────────────
  const handleOpenScanner = async () => {
    setBarcodeError(null)
    // TODO: install @zxing/browser for cross-browser barcode support
    if (!('BarcodeDetector' in window)) {
      setBarcodeError('Barcode scanning requires Chrome or a Chromium-based Android browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScannerActive(true)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })

      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue as string
            stopScanner()
            await lookupBarcode(code)
            return
          }
        } catch { /* frame not ready */ }
        rafRef.current = requestAnimationFrame(scan)
      }
      rafRef.current = requestAnimationFrame(scan)
    } catch (err) {
      setBarcodeError(`Camera access denied: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  const lookupBarcode = async (barcode: string) => {
    // Try Open Food Facts first
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
      const data = await res.json()
      if (data.status === 1 && data.product) {
        const p = data.product
        const n = p.nutriments ?? {}
        const result: USDAResult = {
          fdcId: parseInt(barcode) || 0,
          name: p.product_name || p.abbreviated_product_name || barcode,
          kcalPer100g: n['energy-kcal_100g'] ?? 0,
          protein: n.proteins_100g ?? 0,
          carbs: n.carbohydrates_100g ?? 0,
          fat: n.fat_100g ?? 0,
          fiber: n.fiber_100g ?? 0,
        }
        if (result.kcalPer100g > 0) { setScannedProduct(result); return }
      }
    } catch { /* fallback */ }

    // Fallback: search USDA by barcode string
    try {
      const res = await fetch(`/api/food-search?q=${encodeURIComponent(barcode)}&pageSize=1`)
      const data = await res.json()
      if (data.results?.[0]) { setScannedProduct(data.results[0]); return }
    } catch { /* nothing found */ }

    setBarcodeError(`Product not found for barcode ${barcode}. Try searching manually.`)
  }

  // ── CTA logic per tab ───────────────────────────────────────────────────────
  const ctaLabel = (() => {
    if (aiItems) return ctaLoading ? 'Logging…' : `Log ${aiItems.length} item${aiItems.length !== 1 ? 's' : ''} → ${modalMeal}`
    if (analysing) return 'Analysing…'
    if (methodTab === 'photo' || methodTab === 'voice') return 'Analyse with AI →'
    if (methodTab === 'search') return ctaLoading ? 'Logging…' : 'Add Selected Food'
    if (methodTab === 'barcode') {
      if (scannedProduct) return ctaLoading ? 'Logging…' : `Add ${scannedProduct.name.split(',')[0]}`
      return 'Open Scanner'
    }
    return 'Continue'
  })()

  const handleCTA = () => {
    if (ctaLoading || analysing) return
    if (aiItems) { handleLogAiItems(); return }
    if (methodTab === 'photo' || methodTab === 'voice') { handleAnalyse(); return }
    if (methodTab === 'search') { handleLogSearchResult(); return }
    if (methodTab === 'barcode') {
      if (scannedProduct) { handleLogScannedProduct(); return }
      handleOpenScanner()
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(9,9,9,0.96)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #1c1c1c', padding: '12px 20px 11px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* ← */}
          <button
            onClick={() => shiftDay(-1)}
            style={{ width: 32, height: 32, background: '#181818', border: '1px solid #242424', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="#b8b8b8" strokeWidth="2.2"><polyline points="9,2 4,7 9,12"/></svg>
          </button>

          {/* Date + badge */}
          <div style={{ textAlign: 'center', minWidth: 140 }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', color: '#f0f0f0', lineHeight: 1.1 }}>{dateLabel}</div>
            {isToday && (
              <div style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#3ecf8e', background: '#091510', border: '1px solid #183525', borderRadius: 10, padding: '2px 7px', marginTop: 3 }}>
                Today
              </div>
            )}
          </div>

          {/* → */}
          <button
            onClick={() => shiftDay(1)}
            style={{ width: 32, height: 32, background: '#181818', border: '1px solid #242424', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="#b8b8b8" strokeWidth="2.2"><polyline points="5,2 10,7 5,12"/></svg>
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>

        {/* ── Summary card ──────────────────────────────────────────────── */}
        <div style={{ background: '#121212', border: '1px solid #242424', borderRadius: 22, overflow: 'hidden', marginBottom: 8 }}>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1c1c1c' }}>
            {(['logged', 'remaining'] as SummaryMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: '11px 0 10px', background: 'none', border: 'none',
                  fontFamily: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '0.8px',
                  textTransform: 'uppercase', color: mode === m ? '#3ecf8e' : '#b8b8b8',
                  cursor: 'pointer', position: 'relative',
                }}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
                {mode === m && (
                  <div style={{ position: 'absolute', bottom: -1, left: '22%', right: '22%', height: 2, background: '#3ecf8e', borderRadius: '2px 2px 0 0' }} />
                )}
              </button>
            ))}
          </div>

          {/* Body */}
          <div style={{ padding: '20px 18px 16px', display: 'flex', alignItems: 'center', gap: 20 }}>

            {/* Ring */}
            <div style={{ position: 'relative', width: 112, height: 112, flexShrink: 0 }}>
              <svg width="112" height="112" viewBox="0 0 112 112">
                <circle cx="56" cy="56" r="47" fill="none" stroke="#1a1a1a" strokeWidth="7"/>
                <circle
                  cx="56" cy="56" r="47" fill="none"
                  stroke={ringColor} strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${arcDash.toFixed(1)} ${CIRC}`}
                  transform="rotate(-90 56 56)"
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1, color: '#f0f0f0' }}>{ringNum > 9999 ? '9999+' : ringNum}</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: '#b8b8b8' }}>{ringUnit}</span>
                <span style={{ fontSize: 10, color: '#b8b8b8', letterSpacing: '-0.2px' }}>{ringCtx}</span>
              </div>
            </div>

            {/* Macro bars */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
              {macros.map(({ key, label, color, consumed, target }) => {
                const over = consumed > target
                const barColor = over ? '#ff3b5c' : color
                const displayVal = mode === 'logged' ? Math.round(consumed) : Math.max(0, target - Math.round(consumed))
                const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: barColor, flexShrink: 0 }} />
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: over ? '#ff3b5c' : '#b8b8b8', width: 28, flexShrink: 0 }}>{label}</div>
                    <div style={{ flex: 1, height: 5, background: '#1e1e1e', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: barColor, width: `${pct}%`, transition: 'width 0.35s cubic-bezier(.4,0,.2,1)' }} />
                    </div>
                    <div style={{ minWidth: 54, textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: over ? '#ff3b5c' : '#f0f0f0', letterSpacing: '-0.3px', lineHeight: 1.1 }}>{displayVal}g</div>
                      <div style={{ fontSize: 10, color: '#b8b8b8', fontWeight: 400 }}>/ {target}g</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #1c1c1c', display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr 1px 1fr', padding: '11px 0 10px' }}>
            {mode === 'logged' ? (
              <>
                <div style={{ textAlign: 'center', padding: '0 4px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1 }}>{targets.calories}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: '#b8b8b8', marginTop: 3 }}>Target</div>
                </div>
                <div style={{ background: '#1c1c1c', margin: '3px 0' }} />
                <div style={{ textAlign: 'center', padding: '0 4px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1 }}>{Math.round(totals.calories)}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: '#b8b8b8', marginTop: 3 }}>Eaten</div>
                </div>
                <div style={{ background: '#1c1c1c', margin: '3px 0' }} />
                <div style={{ textAlign: 'center', padding: '0 4px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1, color: remaining.calories >= 0 ? '#3ecf8e' : '#ff3b5c' }}>{Math.abs(remaining.calories)}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: '#b8b8b8', marginTop: 3 }}>Left</div>
                </div>
                <div style={{ background: '#1c1c1c', margin: '3px 0' }} />
                <div style={{ textAlign: 'center', padding: '0 4px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1, color: '#b8b8b8' }}>{Math.round(totals.fiber)}g</div>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: '#b8b8b8', marginTop: 3 }}>Fiber</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '0 4px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1, color: '#f5a623' }}>{Math.max(0, remaining.calories)}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: '#b8b8b8', marginTop: 3 }}>Calories</div>
                </div>
                <div style={{ background: '#1c1c1c', margin: '3px 0' }} />
                <div style={{ textAlign: 'center', padding: '0 4px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1, color: '#4a9eff' }}>{Math.max(0, remaining.protein)}g</div>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: '#b8b8b8', marginTop: 3 }}>Protein</div>
                </div>
                <div style={{ background: '#1c1c1c', margin: '3px 0' }} />
                <div style={{ textAlign: 'center', padding: '0 4px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1, color: '#3ecf8e' }}>{Math.max(0, remaining.carbs)}g</div>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: '#b8b8b8', marginTop: 3 }}>Carbs</div>
                </div>
                <div style={{ background: '#1c1c1c', margin: '3px 0' }} />
                <div style={{ textAlign: 'center', padding: '0 4px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1, color: '#b8b8b8' }}>{Math.max(0, remaining.fat)}g</div>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: '#b8b8b8', marginTop: 3 }}>Fat</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Meal cards ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {MEAL_TYPES.map(meal => {
            const mealLogs = logsByMeal[meal]
            const mealTotals = mealLogs.reduce(
              (acc, l) => ({ calories: acc.calories + l.calories, protein: acc.protein + l.protein, carbs: acc.carbs + l.carbs, fat: acc.fat + l.fat }),
              { calories: 0, protein: 0, carbs: 0, fat: 0 }
            )
            const mealColor = MEAL_CONFIG[meal].color
            const budgetPct = targets.calories > 0 ? Math.min(mealTotals.calories / targets.calories * 100, 100) : 0
            const budgetLabel = targets.calories > 0 ? `${Math.round(mealTotals.calories / targets.calories * 100)}% of day` : '0%'
            const hasItems = mealLogs.length > 0

            return (
              <div key={meal} style={{ background: '#121212', border: '1px solid #242424', borderTop: `2px solid ${mealColor}`, borderRadius: 20, overflow: 'visible' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 12px', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px', color: '#f0f0f0' }}>{MEAL_CONFIG[meal].label}</div>
                    {hasItems ? (
                      <div style={{ marginTop: 3, display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#b8b8b8', letterSpacing: '-0.3px' }}>{Math.round(mealTotals.calories)}</span>
                        <span style={{ color: '#b8b8b8', fontSize: 12 }}>kcal</span>
                        <span style={{ color: '#282828' }}>·</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#4a9eff' }}>{Math.round(mealTotals.protein)}P</span>
                        <span style={{ color: '#282828', fontSize: 10 }}>·</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#3ecf8e' }}>{Math.round(mealTotals.carbs)}C</span>
                        <span style={{ color: '#282828', fontSize: 10 }}>·</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#f5a623' }}>{Math.round(mealTotals.fat)}F</span>
                      </div>
                    ) : (
                      <div style={{ marginTop: 3, fontSize: 12, color: '#b8b8b8' }}>Not logged yet</div>
                    )}
                  </div>
                  <button
                    onClick={() => openModal(meal)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid #242424', borderRadius: 9, padding: '7px 12px', color: '#b8b8b8', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
                    ADD
                  </button>
                </div>

                {/* Budget bar */}
                {hasItems && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 10px' }}>
                    <div style={{ flex: 1, height: 3, background: '#1c1c1c', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${budgetPct}%`, background: mealColor, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.4px', color: '#b8b8b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{budgetLabel}</span>
                  </div>
                )}

                {/* Food rows */}
                {hasItems && (
                  <div style={{ paddingTop: 2 }}>
                    {mealLogs.map(log => (
                      <div
                        key={log.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Edit ${log.food_name}`}
                        onClick={() => openEditSheet(log)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openEditSheet(log)
                          }
                        }}
                        style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 12, borderTop: '1px solid #0f0f0f', minHeight: 58, position: 'relative', cursor: 'pointer' }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: '#f0f0f0', letterSpacing: '-0.1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.food_name}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#b8b8b8', letterSpacing: '-0.1px' }}>{log.quantity}g</span>
                            <span style={{ fontSize: 10, color: '#282828' }}>·</span>
                            <span style={{ fontSize: 11, color: '#b8b8b8', fontWeight: 500 }}><b style={{ fontWeight: 700, color: '#4a9eff' }}>{Math.round(log.protein)}g</b> P</span>
                            <span style={{ fontSize: 11, color: '#b8b8b8', fontWeight: 500 }}><b style={{ fontWeight: 700 }}>{Math.round(log.carbs)}g</b> C</span>
                            <span style={{ fontSize: 11, color: '#b8b8b8', fontWeight: 500 }}><b style={{ fontWeight: 700 }}>{Math.round(log.fat)}g</b> F</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.3px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {Math.round(log.calories)} <span style={{ fontSize: 10, fontWeight: 400, color: '#b8b8b8' }}>kcal</span>
                        </div>
                        {/* ··· action button */}
                        <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid #242424', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#b8b8b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                          </svg>
                        </div>
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={e => { e.stopPropagation(); setActionMenuId(prev => prev === log.id ? null : log.id) }}
                            style={{ width: 22, height: 22, borderRadius: '50%', background: '#181818', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', border: 'none' }}
                          >
                            <svg width="3" height="11" viewBox="0 0 4 14">
                              <circle cx="2" cy="2" r="1.5" fill="#b8b8b8"/>
                              <circle cx="2" cy="7" r="1.5" fill="#b8b8b8"/>
                              <circle cx="2" cy="12" r="1.5" fill="#b8b8b8"/>
                            </svg>
                          </button>
                          {actionMenuId === log.id && (
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{ position: 'absolute', right: 0, top: 28, background: '#181818', border: '1px solid #242424', borderRadius: 10, overflow: 'hidden', zIndex: 10, minWidth: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.6)' }}
                            >
                              <button
                                onClick={() => openEditSheet(log)}
                                style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #242424', color: '#f0f0f0', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteLog(log.id)}
                                style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: '#ff3b5c', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Meal totals footer */}
                {hasItems && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr 1px 1fr', borderTop: '1px solid #0f0f0f', padding: '10px 0 8px', marginTop: 2 }}>
                    <div style={{ textAlign: 'center', padding: '0 4px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1, color: '#4a9eff' }}>{Math.round(mealTotals.protein)}g</div>
                      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#b8b8b8', marginTop: 3 }}>Protein</div>
                    </div>
                    <div style={{ background: '#111', margin: '2px 0' }} />
                    <div style={{ textAlign: 'center', padding: '0 4px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1, color: '#3ecf8e' }}>{Math.round(mealTotals.carbs)}g</div>
                      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#b8b8b8', marginTop: 3 }}>Carbs</div>
                    </div>
                    <div style={{ background: '#111', margin: '2px 0' }} />
                    <div style={{ textAlign: 'center', padding: '0 4px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1, color: '#f5a623' }}>{Math.round(mealTotals.fat)}g</div>
                      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#b8b8b8', marginTop: 3 }}>Fat</div>
                    </div>
                    <div style={{ background: '#111', margin: '2px 0' }} />
                    <div style={{ textAlign: 'center', padding: '0 4px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1 }}>{Math.round(mealTotals.calories)}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#b8b8b8', marginTop: 3 }}>kcal</div>
                    </div>
                  </div>
                )}

                {/* Empty state — dashed tap area */}
                {!hasItems && (
                  <div style={{ padding: '8px 16px 14px', borderTop: '1px solid #0d0d0d' }}>
                    <button
                      onClick={() => openModal(meal)}
                      style={{ width: '100%', border: '1px dashed #888888', borderRadius: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#161616', fontFamily: 'inherit', textAlign: 'left' }}
                    >
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#181818', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#b8b8b8" strokeWidth="2.5"><line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/></svg>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#b8b8b8' }}>Log {MEAL_CONFIG[meal].label.toLowerCase()}</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Daily Reflection section break ───────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 0' }}>
          <div style={{ flex: 1, height: 1, background: '#1c1c1c' }} />
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#b8b8b8', whiteSpace: 'nowrap' }}>Daily Reflection</div>
          <div style={{ flex: 1, height: 1, background: '#1c1c1c' }} />
        </div>

        {/* ── Day note ──────────────────────────────────────────────────── */}
        <div style={{ marginTop: 10, marginBottom: 100 }}>
          <DayNote key={date} userId={userId} date={date} initialNote={dayNote} />
        </div>
      </div>

      {/* ── Bottom sheet modal ────────────────────────────────────────── */}
      {editingLog && editForm && (
      <div
        onClick={closeEditSheet}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${editingLog.food_name}`}
        style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end' }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: '#111', border: '1px solid #242424', borderRadius: '26px 26px 0 0', maxHeight: 'min(88dvh, 720px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <div style={{ width: 36, height: 4, background: '#242424', borderRadius: 2, margin: '12px auto 0', flexShrink: 0 }} />
          <div style={{ padding: '14px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: '1px solid #1c1c1c' }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.4px', color: '#f0f0f0' }}>Edit food</div>
              <div style={{ fontSize: 11, color: '#b8b8b8', marginTop: 3 }}>{MEAL_CONFIG[editForm.meal_type].label} / {dateLabel}</div>
            </div>
            <button onClick={closeEditSheet} style={{ width: 28, height: 28, background: '#181818', border: '1px solid #242424', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#b8b8b8" strokeWidth="2.5" strokeLinecap="round">
                <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
              </svg>
            </button>
          </div>

          <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 20px 12px' }}>
            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#b8b8b8', marginBottom: 6 }}>Name</label>
            <input value={editForm.food_name} onChange={e => updateEditForm('food_name', e.target.value)} style={{ width: '100%', background: '#181818', border: '1px solid #242424', borderRadius: 12, padding: '12px 13px', color: '#f0f0f0', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', outline: 'none', caretColor: '#3ecf8e', marginBottom: 14 }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#b8b8b8', marginBottom: 6 }}>Quantity</label>
                <input type="number" inputMode="decimal" value={editForm.quantity} onChange={e => updateEditForm('quantity', e.target.value)} style={{ width: '100%', background: '#181818', border: '1px solid #242424', borderRadius: 12, padding: '12px 13px', color: '#f0f0f0', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', outline: 'none', caretColor: '#3ecf8e' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#b8b8b8', marginBottom: 6 }}>Unit</label>
                <input value={editForm.unit} readOnly aria-label="Unit" style={{ width: '100%', background: '#141414', border: '1px solid #242424', borderRadius: 12, padding: '12px 13px', color: '#b8b8b8', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', outline: 'none' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {([
                ['calories', 'Calories', 'kcal'],
                ['protein', 'Protein', 'g'],
                ['carbs', 'Carbs', 'g'],
                ['fat', 'Fat', 'g'],
              ] as const).map(([field, label, unit]) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#b8b8b8', marginBottom: 6 }}>{label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#181818', border: '1px solid #242424', borderRadius: 12, padding: '0 11px 0 0' }}>
                    <input type="number" inputMode="decimal" value={editForm[field]} onChange={e => updateEditForm(field, e.target.value)} style={{ minWidth: 0, flex: 1, background: 'none', border: 'none', padding: '12px 13px', color: '#f0f0f0', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', outline: 'none', caretColor: '#3ecf8e' }} />
                    <span style={{ fontSize: 11, color: '#b8b8b8', fontWeight: 700 }}>{unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#b8b8b8', marginBottom: 8 }}>Meal</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {MEAL_TYPES.map(m => (
                <button key={m} onClick={() => updateEditForm('meal_type', m)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: `1px solid ${editForm.meal_type === m ? '#183525' : '#242424'}`, borderRadius: 12, color: editForm.meal_type === m ? '#3ecf8e' : '#b8b8b8', cursor: 'pointer', background: editForm.meal_type === m ? '#091510' : '#181818', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: MEAL_CONFIG[m].color, flexShrink: 0 }} />
                  {MEAL_CONFIG[m].label}
                </button>
              ))}
            </div>

            {editError && <p style={{ fontSize: 12, color: '#ff3b5c', textAlign: 'center', marginBottom: 10 }}>{editError}</p>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 10, padding: '12px 20px calc(16px + env(safe-area-inset-bottom, 0px))', flexShrink: 0, background: '#111', borderTop: '1px solid #1c1c1c' }}>
            <button onClick={() => deleteLog(editingLog.id)} disabled={editSaving} style={{ padding: 14, background: '#181818', border: '1px solid #242424', borderRadius: 14, fontFamily: 'inherit', fontSize: 13, fontWeight: 800, color: '#ff3b5c', cursor: editSaving ? 'default' : 'pointer', opacity: editSaving ? 0.7 : 1 }}>
              Delete
            </button>
            <button onClick={saveEditedLog} disabled={editSaving} style={{ padding: 14, background: '#3ecf8e', border: 'none', borderRadius: 14, fontFamily: 'inherit', fontSize: 15, fontWeight: 800, letterSpacing: '0.2px', color: '#000', cursor: editSaving ? 'default' : 'pointer', opacity: editSaving ? 0.7 : 1 }}>
              {editSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
      )}

      {modalOpen && (
      <div
        onClick={closeModal}
        role="dialog"
        aria-modal="true"
        aria-label={`Log ${MEAL_CONFIG[modalMeal].label}`}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'flex-end',
          transition: 'opacity 0.22s ease',
        }}
      >
        {/* Sheet */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 430, margin: '0 auto',
            background: '#111', border: '1px solid #242424',
            borderRadius: '26px 26px 0 0',
            height: 'min(88dvh, 720px)',
            maxHeight: 'min(88dvh, 720px)',
            display: 'flex', flexDirection: 'column',
            minHeight: 0,
            transform: 'translateY(0)',
            transition: 'transform 0.3s cubic-bezier(.32,.72,0,1)',
            overflow: 'hidden',
          }}
        >
          {/* Handle */}
          <div style={{ width: 36, height: 4, background: '#242424', borderRadius: 2, margin: '12px auto 0', flexShrink: 0 }} />

          {/* Modal header */}
          <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.4px', color: '#f0f0f0' }}>
              Log {MEAL_CONFIG[modalMeal].label}
            </div>
            <button
              onClick={closeModal}
              style={{ width: 28, height: 28, background: '#181818', border: '1px solid #242424', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#b8b8b8" strokeWidth="2.5" strokeLinecap="round">
                <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
              </svg>
            </button>
          </div>

          {/* Meal chips */}
          <div style={{ display: 'flex', gap: 6, padding: '14px 20px 0', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
            {MEAL_TYPES.map(m => (
              <button
                key={m}
                onClick={() => setModalMeal(m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px',
                  border: `1px solid ${modalMeal === m ? '#183525' : '#242424'}`,
                  borderRadius: 20, fontSize: 12, fontWeight: 600,
                  color: modalMeal === m ? '#3ecf8e' : '#b8b8b8',
                  cursor: 'pointer', whiteSpace: 'nowrap', background: modalMeal === m ? '#091510' : 'none',
                  fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.15s',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: MEAL_CONFIG[m].color }} />
                {MEAL_CONFIG[m].label}
              </button>
            ))}
          </div>

          {/* Method tabs */}
          <div style={{ display: 'flex', padding: '14px 20px 0', borderBottom: '1px solid #1c1c1c', flexShrink: 0 }}>
            {METHOD_TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => { if (!aiItems) { setMethodTab(id); setAiError(null) } }}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  padding: '6px 4px 11px', cursor: 'pointer', border: 'none', background: 'none',
                  fontFamily: 'inherit', position: 'relative',
                  color: methodTab === id ? '#3ecf8e' : '#b8b8b8', transition: 'color 0.15s',
                }}
              >
                {icon}
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'inherit' }}>{label}</span>
                {methodTab === id && (
                  <div style={{ position: 'absolute', bottom: -1, left: '18%', right: '18%', height: 2, background: '#3ecf8e', borderRadius: '2px 2px 0 0' }} />
                )}
              </button>
            ))}
          </div>

          {/* Scrollable body with top fade hint */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
            {/* Top fade */}
            <div style={{ content: '', pointerEvents: 'none', position: 'absolute', top: 0, left: 0, right: 0, height: 28, zIndex: 2, background: 'linear-gradient(to bottom, #111 0%, transparent 100%)' }} />
            <div style={{ height: '100%', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', padding: '0 20px', scrollbarWidth: 'none' }}>

              {/* ── AI items edit view ── */}
              {aiItems ? (
                <div style={{ padding: '16px 0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {aiWarnings.length > 0 && (
                    <div style={{ background: '#1a1305', border: '1px solid rgba(245,166,35,0.35)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {aiWarnings.map((warning, i) => (
                        <p key={`${warning.message}-${i}`} style={{ margin: 0, fontSize: 12, color: '#f5a623', lineHeight: 1.45 }}>
                          {warning.message}
                        </p>
                      ))}
                    </div>
                  )}
                  {aiItems.map(item => (
                    <div key={item._id} style={{ background: '#181818', border: '1px solid #242424', borderRadius: 14, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => updateAiItem(item._id, 'name', e.target.value)}
                          style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid #242424', color: '#f0f0f0', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', outline: 'none', paddingBottom: 2, caretColor: '#3ecf8e' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {item.confidence === 'low' && <span style={{ fontSize: 10, color: '#f5a623' }} title="Low confidence">⚠</span>}
                          <button onClick={() => removeAiItem(item._id)} style={{ background: 'none', border: 'none', color: '#b8b8b8', cursor: 'pointer', lineHeight: 1 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                        {([
                          { label: 'KCAL', field: 'calories' as keyof FoodAIItem, color: '#b8b8b8' },
                          { label: 'P', field: 'protein' as keyof FoodAIItem, color: '#4a9eff' },
                          { label: 'C', field: 'carbs' as keyof FoodAIItem, color: '#3ecf8e' },
                          { label: 'F', field: 'fat' as keyof FoodAIItem, color: '#f5a623' },
                        ] as const).map(({ label, field, color }) => (
                          <div key={field} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: 9, letterSpacing: '0.8px', marginBottom: 4, color }}>{label}</span>
                            <input
                              type="number"
                              value={Math.round((item[field] as number) * 10) / 10}
                              onChange={e => updateAiItem(item._id, field, e.target.value)}
                              style={{ width: '100%', background: '#121212', border: '1px solid #242424', borderRadius: 8, padding: '6px 4px', fontSize: 12, color: '#f0f0f0', fontFamily: 'monospace', textAlign: 'center', outline: 'none' }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: '#b8b8b8', letterSpacing: '0.8px' }}>QTY</span>
                        <input
                          type="number"
                          value={item.quantity_g}
                          onChange={e => updateAiItem(item._id, 'quantity_g', e.target.value)}
                          style={{ width: 64, background: '#121212', border: '1px solid #242424', borderRadius: 8, padding: '5px 8px', fontSize: 12, color: '#f0f0f0', fontFamily: 'monospace', outline: 'none' }}
                        />
                        <span style={{ fontSize: 10, color: '#b8b8b8' }}>g</span>
                      </div>
                    </div>
                  ))}
                  {aiError && <p style={{ fontSize: 12, color: '#ff3b5c', textAlign: 'center', padding: '4px 0' }}>{aiError}</p>}
                  <button onClick={() => { setAiItems(null); setAiError(null); setAiWarnings([]) }} style={{ background: 'none', border: 'none', color: '#b8b8b8', fontSize: 11, letterSpacing: '0.8px', textTransform: 'uppercase', cursor: 'pointer', padding: '8px 0', fontFamily: 'inherit' }}>
                    Retake / Edit
                  </button>
                </div>

              ) : analysing ? (
                /* Loading */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '48px 0' }}>
                  <div style={{ width: 36, height: 36, border: '2px solid #3ecf8e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <p style={{ fontSize: 12, color: '#b8b8b8', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Analysing your meal…</p>
                </div>

              ) : (
                <>
                  {/* ── Photo panel ── */}
                  {methodTab === 'photo' && (
                    <div style={{ padding: '16px 0 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {imagePreview ? (
                        <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#181818' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imagePreview} alt="Food preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                          <button
                            onClick={() => { setImagePreview(null); setImageData(null) }}
                            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', borderRadius: '50%', padding: 6, border: 'none', cursor: 'pointer', lineHeight: 1 }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b8b8b8" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          style={{ background: '#181818', border: '1.5px dashed #242424', borderRadius: 16, height: 148, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}
                        >
                          <div style={{ width: 40, height: 40, background: '#1e1e1e', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b8b8b8" strokeWidth="1.8" strokeLinecap="round">
                              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                              <circle cx="12" cy="13" r="4"/>
                            </svg>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#b8b8b8' }}>Take a photo of your meal</div>
                          <div style={{ fontSize: 11, color: '#282828' }}>Tap to open camera</div>
                        </button>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                        onChange={async e => {
                          const file = e.target.files?.[0]; if (!file) return
                          const b64 = await toBase64(file)
                          setImagePreview(b64); setImageData(b64); setAiError(null)
                        }}
                      />
                      {/* Weight field */}
                      <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: 14, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, background: '#1e1e1e', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b8b8b8" strokeWidth="1.8" strokeLinecap="round">
                            <path d="M12 3a4 4 0 014 4H8a4 4 0 014-4z"/><rect x="2" y="7" width="20" height="14" rx="2"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#b8b8b8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            Total weight <span style={{ fontSize: 9, fontWeight: 600, color: '#3ecf8e', textTransform: 'none', letterSpacing: '0.3px' }}>↑ improves accuracy</span>
                          </div>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={photoWeight}
                            onChange={e => setPhotoWeight(e.target.value)}
                            placeholder="e.g. 350"
                            style={{ background: 'none', border: 'none', color: '#f0f0f0', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', width: '100%', outline: 'none', caretColor: '#3ecf8e' }}
                          />
                        </div>
                        <div style={{ fontSize: 12, color: '#b8b8b8', fontWeight: 600, flexShrink: 0 }}>g</div>
                      </div>
                      {/* Description field */}
                      <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: 14, padding: '11px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 28, height: 28, background: '#1e1e1e', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b8b8b8" strokeWidth="1.8" strokeLinecap="round">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#b8b8b8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            Describe your meal <span style={{ fontSize: 9, fontWeight: 600, color: '#3ecf8e', textTransform: 'none' }}>↑ improves accuracy</span>
                          </div>
                          <textarea
                            value={photoDesc}
                            onChange={e => setPhotoDesc(e.target.value)}
                            placeholder="e.g. grilled in olive oil, extra dressing…"
                            style={{ background: 'none', border: 'none', color: '#f0f0f0', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', width: '100%', outline: 'none', resize: 'none', lineHeight: 1.5, caretColor: '#3ecf8e', minHeight: 72, overflow: 'auto', whiteSpace: 'normal' }}
                          />
                        </div>
                      </div>
                      {aiError && <p style={{ fontSize: 12, color: '#ff3b5c', textAlign: 'center' }}>{aiError}</p>}
                    </div>
                  )}

                  {/* ── Voice panel ── */}
                  {methodTab === 'voice' && (
                    <div style={{ padding: '16px 0 12px' }}>
                      <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: 16, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                          <textarea
                            value={voiceText}
                            onChange={e => setVoiceText(e.target.value)}
                            rows={3}
                            placeholder="Describe your full meal…"
                            autoFocus
                            style={{ flex: 1, background: 'none', border: 'none', color: '#f0f0f0', fontSize: 15, fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.55, caretColor: '#3ecf8e', minHeight: 70 }}
                          />
                          <button
                            onClick={() => {
                              setMicError(null)
                              if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
                                setMicError('Speech recognition not supported in this browser. Try Chrome.')
                                return
                              }
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
                              const rec = new SR()
                              rec.lang = 'en-US'; rec.interimResults = false
                              rec.onstart = () => setMicListening(true)
                              rec.onend = () => setMicListening(false)
                              rec.onerror = (e: { error: string }) => {
                                setMicListening(false)
                                if (e.error === 'not-allowed') setMicError('Microphone access denied — allow it in browser settings.')
                                else if (e.error === 'no-speech') setMicError('No speech detected. Try again.')
                                else if (e.error === 'network') setMicError('Speech recognition unavailable on this connection. Just type your meal above.')
                                else setMicError('Mic unavailable. Just type your meal above.')
                              }
                              rec.onresult = (e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => setVoiceText(prev => prev + (prev ? ' ' : '') + e.results[0][0].transcript)
                              rec.start()
                            }}
                            style={{ width: 38, height: 38, background: micListening ? '#091510' : '#1e1e1e', border: `1px solid ${micListening ? '#3ecf8e' : '#242424'}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b8b8b8" strokeWidth="1.8" strokeLinecap="round">
                              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4"/>
                            </svg>
                          </button>
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#b8b8b8', marginBottom: 6 }}>Tap to use as example</div>
                        <button
                          onClick={() => setVoiceText(VOICE_EXAMPLE)}
                          style={{ fontSize: 12, color: '#b8b8b8', lineHeight: 1.55, background: '#1e1e1e', border: '1px solid #242424', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontStyle: 'italic', width: '100%' }}
                        >
                          &ldquo;{VOICE_EXAMPLE}&rdquo;
                          <div style={{ fontSize: 10, color: '#282828', marginTop: 5, fontStyle: 'normal' }}>Tap to copy into the field above ↑</div>
                        </button>
                      </div>
                      {micListening && <p style={{ fontSize: 11, color: '#3ecf8e', textAlign: 'center', marginTop: 8, letterSpacing: '0.6px' }}>Listening…</p>}
                      {micError && <p style={{ fontSize: 12, color: '#ff3b5c', textAlign: 'center', marginTop: 8 }}>{micError}</p>}
                      {aiError && <p style={{ fontSize: 12, color: '#ff3b5c', textAlign: 'center', marginTop: 8 }}>{aiError}</p>}
                    </div>
                  )}

                  {/* ── Search panel ── */}
                  {methodTab === 'search' && (
                    <div style={{ padding: '16px 0 12px' }}>
                      {/* Search input */}
                      <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b8b8b8" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => handleSearchChange(e.target.value)}
                          placeholder="Search USDA database…"
                          autoFocus
                          style={{ flex: 1, background: 'none', border: 'none', color: '#f0f0f0', fontSize: 15, fontFamily: 'inherit', outline: 'none', caretColor: '#3ecf8e' }}
                        />
                        {searching && <span style={{ fontSize: 11, color: '#b8b8b8', animation: 'pulse 1s ease-in-out infinite' }}>…</span>}
                      </div>

                      {/* Results */}
                      {searchResults.length > 0 ? (
                        <div style={{ background: '#181818', border: '1px solid #242424', borderRadius: 14, overflow: 'hidden' }}>
                          {searchResults.map((result, idx) => {
                            const isSelected = selectedResult?.fdcId === result.fdcId
                            const firstLetter = result.name.charAt(0).toUpperCase()
                            // Color letter-circle based on current meal
                            const lcColor = MEAL_CONFIG[modalMeal].color
                            return (
                              <div key={result.fdcId}>
                                <button
                                  onClick={() => {
                                    setSelectedResult(isSelected ? null : result)
                                    setSelectedQty('')
                                    setSearchError(null)
                                  }}
                                  style={{
                                    display: 'flex', alignItems: 'center', padding: '11px 14px', gap: 12,
                                    minHeight: 64,
                                    borderBottom: idx < searchResults.length - 1 ? '1px solid #0e0e0e' : 'none',
                                    cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'inherit',
                                    background: isSelected ? '#091510' : 'none',
                                    transition: 'background 0.1s',
                                  }}
                                >
                                  <div style={{ width: 32, height: 32, borderRadius: 8, background: isSelected ? '#0d2018' : '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 800, color: isSelected ? lcColor : '#b8b8b8' }}>
                                    {firstLetter}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: isSelected ? '#3ecf8e' : '#f0f0f0', letterSpacing: '-0.1px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{result.name}</div>
                                    <div style={{ fontSize: 11, color: '#b8b8b8', marginTop: 2 }}>USDA · per 100g · {result.protein}g P · {result.carbs}g C · {result.fat}g F</div>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0, alignSelf: 'center' }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#b8b8b8' }}>{result.kcalPer100g}</div>
                                    <div style={{ fontSize: 10, color: '#b8b8b8' }}>kcal</div>
                                  </div>
                                </button>
                                {/* Inline qty row */}
                                {isSelected && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 12px', background: '#091510', borderBottom: idx < searchResults.length - 1 ? '1px solid #0e0e0e' : 'none' }}>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      value={selectedQty}
                                      onChange={e => { setSelectedQty(e.target.value); setSearchError(null) }}
                                      autoFocus
                                      placeholder="Enter weight…"
                                      style={{ flex: 1, background: '#121212', border: '1px solid #183525', borderRadius: 10, padding: '9px 12px', color: '#f0f0f0', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', outline: 'none', caretColor: '#3ecf8e' }}
                                    />
                                    <span style={{ fontSize: 12, color: '#3ecf8e', fontWeight: 700, flexShrink: 0 }}>g</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          {searchError && (
                            <p style={{ fontSize: 12, color: '#ff3b5c', textAlign: 'center', padding: '10px 14px' }}>{searchError}</p>
                          )}
                        </div>
                      ) : searchError ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                          <p style={{ fontSize: 13, color: '#ff3b5c' }}>{searchError}</p>
                        </div>
                      ) : searchQuery && !searching ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                          <p style={{ fontSize: 14, color: '#b8b8b8' }}>No results for &ldquo;{searchQuery}&rdquo;</p>
                          <p style={{ fontSize: 11, color: '#282828', marginTop: 6 }}>Try a simpler name, e.g. &ldquo;chicken breast&rdquo;</p>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                          <p style={{ fontSize: 11, color: '#282828', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Type to search</p>
                          <p style={{ fontSize: 11, color: '#1c1c1c', marginTop: 6 }}>USDA FoodData Central</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Barcode panel ── */}
                  {methodTab === 'barcode' && (
                    <div style={{ padding: '16px 0 12px' }}>
                      {scannedProduct ? (
                        /* Found product */
                        <div style={{ background: '#181818', border: '1px solid #3ecf8e', borderRadius: 16, padding: 16 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', marginBottom: 4 }}>{scannedProduct.name}</div>
                          <div style={{ fontSize: 11, color: '#b8b8b8', marginBottom: 12 }}>per 100g · {scannedProduct.kcalPer100g} kcal · {scannedProduct.protein}g P · {scannedProduct.carbs}g C · {scannedProduct.fat}g F</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={scannedQty}
                              onChange={e => { setScannedQty(e.target.value); setBarcodeError(null) }}
                              placeholder="Enter weight..."
                              style={{ flex: 1, background: '#121212', border: '1px solid #183525', borderRadius: 10, padding: '9px 12px', color: '#f0f0f0', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', outline: 'none' }}
                            />
                            <span style={{ fontSize: 12, color: '#3ecf8e', fontWeight: 700 }}>g</span>
                          </div>
                          <button onClick={() => { setScannedProduct(null); setBarcodeError(null) }} style={{ marginTop: 10, background: 'none', border: 'none', color: '#b8b8b8', fontSize: 11, letterSpacing: '0.8px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Scan again
                          </button>
                        </div>
                      ) : (
                        /* Scanner UI */
                        <div
                          style={{ background: '#181818', border: '1px solid #242424', borderRadius: 16, height: 178, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                          onClick={!scannerActive ? handleOpenScanner : undefined}
                        >
                          {scannerActive ? (
                            <video ref={videoRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
                          ) : (
                            <>
                              {/* Animated beam */}
                              <div style={{
                                position: 'absolute', left: '18%', right: '18%', height: 1.5,
                                background: '#3ecf8e', opacity: 0.7,
                                boxShadow: '0 0 10px #3ecf8e',
                                animation: 'barcode-beam 2s ease-in-out infinite',
                              }} />
                              {/* Corner markers */}
                              <div style={{ position: 'absolute', inset: 24 }}>
                                {[
                                  { top: 0, left: 0, borderWidth: '2px 0 0 2px', borderRadius: '3px 0 0 0' },
                                  { top: 0, right: 0, borderWidth: '2px 2px 0 0', borderRadius: '0 3px 0 0' },
                                  { bottom: 0, left: 0, borderWidth: '0 0 2px 2px', borderRadius: '0 0 0 3px' },
                                  { bottom: 0, right: 0, borderWidth: '0 2px 2px 0', borderRadius: '0 0 3px 0' },
                                ].map((s, i) => (
                                  <div key={i} style={{ position: 'absolute', width: 20, height: 20, borderStyle: 'solid', borderColor: '#3ecf8e', opacity: 0.7, ...s }} />
                                ))}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#b8b8b8', position: 'relative', zIndex: 1 }}>Point camera at barcode</div>
                              <div style={{ fontSize: 11, color: '#282828', position: 'relative', zIndex: 1 }}>Open Food Facts · USDA · 3M+ products</div>
                            </>
                          )}
                        </div>
                      )}
                      {barcodeError && <p style={{ fontSize: 12, color: '#ff3b5c', textAlign: 'center', marginTop: 8 }}>{barcodeError}</p>}
                    </div>
                  )}
                </>
              )}

            </div>
          </div>

          {/* Pinned CTA */}
          <div style={{ padding: '12px 20px calc(16px + env(safe-area-inset-bottom, 0px))', flexShrink: 0, background: '#111', borderTop: '1px solid #1c1c1c' }}>
            <button
              onClick={handleCTA}
              disabled={ctaLoading || analysing}
              style={{
                width: '100%', padding: 16, background: '#3ecf8e', border: 'none', borderRadius: 14,
                fontFamily: 'inherit', fontSize: 15, fontWeight: 800, letterSpacing: '0.2px', color: '#000',
                cursor: ctaLoading || analysing ? 'default' : 'pointer',
                opacity: ctaLoading || analysing ? 0.7 : 1, transition: 'opacity 0.15s',
              }}
            >
              {ctaLabel}
            </button>
          </div>

        </div>
      </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes barcode-beam {
          0%, 100% { top: 35%; opacity: 0.5; }
          50% { top: 65%; opacity: 0.9; }
        }
      `}</style>
    </div>
  )
}
