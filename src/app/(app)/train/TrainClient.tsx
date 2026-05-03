'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeMuscleSplit } from '@/lib/muscleMap'
import { THREE_DAY_TEMPLATE, createDefaultRoutines } from '@/lib/createDefaultRoutines'
import WorkoutHistory from './WorkoutHistory'

const PROGRAM_NAME = 'LazyFit 3-Day Aesthetic'

interface Routine {
  id: string
  name: string
  exerciseCount: number
  is_system: boolean
  canDelete: boolean
}

interface WorkoutSet {
  exercise_name: string
  weight_kg: number
  reps_completed: number
}

interface LastWorkout {
  id: string
  completedAt: string
  durationMinutes: number | null
  routineName: string | null
  sets: WorkoutSet[]
}

interface Props {
  userId: string
  routines: Routine[]
  lastWorkout: LastWorkout | null
}

function relativeDate(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff} days ago`
}

function getRoutineTags(name: string): string[] {
  const n = name.toLowerCase()
  if (n.includes('upper a') || (n.includes('upper') && n.includes('a'))) return ['Push', 'Upper']
  if (n.includes('upper b') || (n.includes('upper') && n.includes('b'))) return ['Pull', 'Upper']
  if (n.includes('upper')) return ['Upper']
  if (n.includes('lower') || n.includes('leg')) return ['Legs', 'Lower']
  if (n.includes('push')) return ['Push']
  if (n.includes('pull')) return ['Pull']
  return []
}

function getProgramDayNumber(name: string): number | null {
  const idx = THREE_DAY_TEMPLATE.findIndex(tpl => tpl.name === name)
  return idx >= 0 ? idx + 1 : null
}

// ── Main component ────────────────────────────────────────────────────────────
function findRecommendedRoutine(routines: Routine[], lastRoutineName: string | null) {
  const starterNames = THREE_DAY_TEMPLATE.map(tpl => tpl.name)
  const starterRoutines = starterNames
    .map(name => routines.find(r => r.name === name))
    .filter((r): r is Routine => Boolean(r))

  if (starterRoutines.length === 0) return routines[0] ?? null

  const lastStarterIdx = lastRoutineName ? starterNames.indexOf(lastRoutineName) : -1
  if (lastStarterIdx >= 0) {
    for (let offset = 1; offset <= starterNames.length; offset++) {
      const nextName = starterNames[(lastStarterIdx + offset) % starterNames.length]
      const nextRoutine = starterRoutines.find(r => r.name === nextName)
      if (nextRoutine) return nextRoutine
    }
  }

  return starterRoutines[0]
}

export default function TrainClient({ userId, routines: initialRoutines, lastWorkout }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'routines' | 'history'>('routines')
  const [routines, setRoutines] = useState<Routine[]>(initialRoutines)
  const [starting, setStarting] = useState<string | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [showNewRoutine, setShowNewRoutine] = useState(false)
  const [newRoutineName, setNewRoutineName] = useState('')
  const [creatingRoutine, setCreatingRoutine] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [recoveryWorkout, setRecoveryWorkout] = useState<{ workoutId: string } | null>(null)

  // On mount: scan localStorage for any unfinished workout draft and verify it's still open in DB
  useEffect(() => {
    const checkDraft = async () => {
      const key = Object.keys(localStorage).find(k => k.startsWith('lazyfit_workout_draft_'))
      if (!key) return
      const workoutId = key.replace('lazyfit_workout_draft_', '')
      const { data } = await supabase
        .from('workouts')
        .select('id, completed_at')
        .eq('id', workoutId)
        .eq('user_id', userId)
        .single()
      if (!data || data.completed_at) { localStorage.removeItem(key); return }
      setRecoveryWorkout({ workoutId })
    }
    checkDraft()
  }, [supabase, userId])

  const MUSCLE_COLORS = ['#3ecf8e', '#2a6e50', '#1a3d2c']
  const muscleSplit = lastWorkout
    ? computeMuscleSplit(lastWorkout.sets).slice(0, 3).map((m, i) => ({ ...m, color: MUSCLE_COLORS[i] }))
    : []
  const totalVolume = lastWorkout
    ? Math.round(lastWorkout.sets.reduce((s, r) => s + r.weight_kg * r.reps_completed, 0))
    : 0
  const recommendedRoutine = findRecommendedRoutine(routines, lastWorkout?.routineName ?? null)

  const startWorkout = async (routineId?: string) => {
    const key = routineId ?? 'empty'
    setStarting(key)
    const { data, error } = await supabase
      .from('workouts')
      .insert({ user_id: userId, routine_id: routineId ?? null, started_at: new Date().toISOString() })
      .select('id')
      .single()
    if (error || !data) { setStarting(null); alert('Could not start workout. Try again.'); return }
    router.push(routineId ? `/train/${data.id}?routineId=${routineId}` : `/train/${data.id}?empty=true`)
  }

  const loadTemplate = async () => {
    setLoadingTemplate(true)
    try {
      await createDefaultRoutines(supabase, userId)
      router.refresh()
    } catch {
      alert('Could not load template. Try again.')
    } finally {
      setLoadingTemplate(false)
    }
  }

  const handleDelete = async (routineId: string) => {
    const routine = routines.find(r => r.id === routineId)
    if (!routine?.canDelete) return

    setConfirmDelete(null)
    const { error } = await supabase
      .from('routines')
      .delete()
      .eq('id', routineId)
      .eq('is_system', false)
    if (!error) {
      setRoutines(prev => prev.filter(r => r.id !== routineId))
    }
  }

  const createRoutine = async () => {
    if (!newRoutineName.trim()) return
    setCreatingRoutine(true)
    const { data, error } = await supabase
      .from('routines')
      .insert({ user_id: userId, name: newRoutineName.trim() })
      .select('id')
      .single()
    if (!error && data) {
      setRoutines(prev => [...prev, { id: data.id, name: newRoutineName.trim(), exerciseCount: 0, is_system: false, canDelete: true }])
      setShowNewRoutine(false)
      setNewRoutineName('')
    }
    setCreatingRoutine(false)
  }

  const sectionLabel = {
    fontSize: '10px',
    fontWeight: 700,
    color: '#b8b8b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    paddingTop: '4px',
    paddingBottom: '2px',
  }

  return (
    <>
      {/* ── Sticky header ─────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, backgroundColor: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
        <div style={{ padding: '18px 20px 0' }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.5px', marginBottom: '14px' }}>
            Train
          </div>
          {/* Underline tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a' }}>
            {(['routines', 'history'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); if (tab === 'history') setShowNewRoutine(false) }}
                style={{
                  padding: '8px 0',
                  marginRight: '24px',
                  marginBottom: '-1px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: activeTab === tab ? '#f0f0f0' : '#888888',
                  border: 'none',
                  borderBottomWidth: '2px',
                  borderBottomStyle: 'solid',
                  borderBottomColor: activeTab === tab ? '#3ecf8e' : 'transparent',
                  background: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'color 0.15s',
                }}
              >
                {tab === 'routines' ? 'Program' : 'History'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── History tab ───────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div style={{ padding: '16px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>
          <WorkoutHistory userId={userId} />
        </div>
      )}

      {/* ── Program tab ──────────────────────────────────────── */}
      {activeTab === 'routines' && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif' }}>

          {/* Unfinished workout recovery banner */}
          {recoveryWorkout && (
            <div style={{ background: '#1a0d00', border: '1px solid rgba(245,166,35,0.3)', borderRadius: '12px', padding: '12px 16px', margin: '0 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#f5a623' }}>
                You have an unfinished workout. Resume or discard?
              </p>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={() => router.push(`/train/${recoveryWorkout.workoutId}`)}
                  style={{ background: '#f5a623', color: '#000', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Resume
                </button>
                <button
                  onClick={() => { localStorage.removeItem(`lazyfit_workout_draft_${recoveryWorkout.workoutId}`); setRecoveryWorkout(null) }}
                  style={{ background: 'none', border: '1px solid rgba(245,166,35,0.3)', color: '#f5a623', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Last session card */}
          {lastWorkout && (
            <>
              <div style={sectionLabel}>Last session</div>
              <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#f0f0f0' }}>
                      {lastWorkout.routineName ?? 'Custom Workout'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#b8b8b8', marginTop: '3px' }}>
                      {relativeDate(lastWorkout.completedAt)}
                      {lastWorkout.durationMinutes ? ` · ${lastWorkout.durationMinutes} min` : ''}
                      {totalVolume > 0 ? ` · ${totalVolume.toLocaleString()} kg total` : ''}
                    </div>
                  </div>
                  <Link
                    href={`/train/summary/${lastWorkout.id}`}
                    style={{ fontSize: '12px', fontWeight: 600, color: '#3ecf8e', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '12px' }}
                  >
                    View →
                  </Link>
                </div>

                {/* Muscle bars — 3-column flex row per muscle */}
                {muscleSplit.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {muscleSplit.slice(0, 3).map(m => (
                      <div key={m.muscle} style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '10px', color: '#b8b8b8' }}>{m.muscle}</span>
                          <span style={{ fontSize: '10px', color: '#888' }}>{m.pct}%</span>
                        </div>
                        <div style={{ background: '#1e1e1e', borderRadius: '3px', height: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${m.pct}%`, height: '100%', background: m.color, borderRadius: '3px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Program section */}
          <div style={{ ...sectionLabel, marginTop: lastWorkout ? '4px' : 0 }}>Your Program</div>
          <div style={{ background: '#0d1a12', border: '1px solid #1a3528', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#3ecf8e', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '5px' }}>
              Program
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#f0f0f0', letterSpacing: '0' }}>
              {PROGRAM_NAME}
            </div>
            <div style={{ fontSize: '12px', color: '#b8b8b8', marginTop: '5px', lineHeight: 1.45 }}>
              Three workout days. Rotate in order. LazyFit picks the next one.
            </div>
          </div>

          <div style={sectionLabel}>Workout days</div>

          {routines.length === 0 ? (
            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
              <p style={{ color: '#b8b8b8', fontSize: '13px', marginBottom: '16px' }}>
                No workout days loaded yet. Load Upper A, Lower A, and Upper B.
              </p>
              <button
                onClick={loadTemplate}
                disabled={loadingTemplate}
                style={{ background: '#3ecf8e', color: '#0a0a0a', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: loadingTemplate ? 0.4 : 1, fontFamily: 'inherit' }}
              >
                {loadingTemplate ? 'Loading...' : `Load ${PROGRAM_NAME}`}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {routines.map(r => {
                const isLastDone = r.name === lastWorkout?.routineName
                const isRecommended = r.id === recommendedRoutine?.id
                const tags = getRoutineTags(r.name)
                const programDayNumber = getProgramDayNumber(r.name)
                return (
                  <div
                    key={r.id}
                    style={{
                      background: isRecommended ? '#0d1a12' : '#141414',
                      border: `1px solid ${isRecommended ? '#3ecf8e' : isLastDone ? '#1a3528' : '#1e1e1e'}`,
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '140px',
                      position: 'relative',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10px', color: isRecommended ? '#3ecf8e' : '#b8b8b8', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        {programDayNumber ? `Workout day ${programDayNumber}` : 'Custom routine'}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.3px' }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#b8b8b8', marginTop: '2px' }}>
                        {r.exerciseCount} exercises
                      </div>
                      {isRecommended && (
                        <div style={{ fontSize: '10px', color: '#3ecf8e', marginTop: '4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                          Recommended next
                        </div>
                      )}
                      {isLastDone && lastWorkout && (
                        <div style={{ fontSize: '10px', color: '#2a6e50', marginTop: '4px', fontWeight: 500 }}>
                          Done {relativeDate(lastWorkout.completedAt).toLowerCase()}
                        </div>
                      )}
                      {tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
                          {tags.map(tag => (
                            <span
                              key={tag}
                              style={{ fontSize: '12px', fontWeight: 500, padding: '3px 7px', borderRadius: '20px', background: '#1e1e1e', color: '#b8b8b8' }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Delete control - only for custom routines */}
                    {r.canDelete && (
                      confirmDelete === r.id ? (
                        <div style={{ position: 'absolute', top: '8px', right: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#b8b8b8' }}>Delete?</span>
                          <span onClick={() => handleDelete(r.id)} style={{ fontSize: '11px', color: '#ff4444', cursor: 'pointer', fontWeight: 600 }}>Yes</span>
                          <span onClick={() => setConfirmDelete(null)} style={{ fontSize: '11px', color: '#b8b8b8', cursor: 'pointer' }}>No</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(r.id)}
                          style={{ position: 'absolute', top: '10px', right: '12px', background: 'none', border: 'none', color: '#b8b8b8', fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '0', fontFamily: 'inherit' }}
                        >
                          ×
                        </button>
                      )
                    )}

                    <button
                      onClick={() => startWorkout(r.id)}
                      disabled={starting !== null}
                      style={{
                        background: isRecommended ? '#3ecf8e' : '#202020',
                        color: isRecommended ? '#0a0a0a' : '#f0f0f0',
                        border: isRecommended ? 'none' : '1px solid #2a2a2a',
                        borderRadius: '8px',
                        padding: '9px 0',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: starting !== null ? 'not-allowed' : 'pointer',
                        width: '100%',
                        marginTop: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        opacity: starting !== null ? 0.4 : 1,
                        fontFamily: 'inherit',
                      }}
                    >
                      {starting === r.id ? '…' : (
                        <>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill={isRecommended ? '#0a0a0a' : '#f0f0f0'}>
                            <polygon points="5,3 19,12 5,21" />
                          </svg>
                          {isRecommended ? 'Start recommended' : 'Start'}
                        </>
                      )}
                    </button>
                  </div>
                )
              })}

              {/* Custom routine dashed card */}
              <div
                onClick={() => setShowNewRoutine(true)}
                style={{
                  background: 'transparent',
                  border: '1px dashed #1a1a1a',
                  borderRadius: '12px',
                  minHeight: '140px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  opacity: 0.72,
                }}
              >
                <div style={{ fontSize: '24px', color: '#888888', fontWeight: 300, lineHeight: 1 }}>+</div>
                <div style={{ fontSize: '12px', color: '#b8b8b8', fontWeight: 600 }}>Custom routine</div>
                <div style={{ fontSize: '10px', color: '#888888' }}>Optional</div>
              </div>
            </div>
          )}

          {/* Start empty workout */}
          <button
            onClick={() => startWorkout()}
            disabled={starting !== null}
            style={{
              background: 'none',
              border: '1px solid #111',
              borderRadius: '10px',
              padding: '12px',
              color: '#888888',
              fontSize: '12px',
              fontWeight: 500,
              width: '100%',
              cursor: starting !== null ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: starting !== null ? 0.4 : 1,
              fontFamily: 'inherit',
            }}
          >
            {starting === 'empty' ? 'Starting…' : '+ Start empty workout'}
          </button>

        </div>
      )}

      {/* ── Custom routine modal ─────────────────────────────────── */}
      {showNewRoutine && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)' }}>
          <div style={{ width: '100%', background: '#0d0d0d', borderTop: '1px solid #222', borderRadius: '16px 16px 0 0', padding: '24px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '16px' }}>New custom routine</p>
            <input
              type="text"
              value={newRoutineName}
              onChange={e => setNewRoutineName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createRoutine()}
              autoFocus
              placeholder="e.g. Push Day"
              style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', color: '#f0f0f0', outline: 'none', marginBottom: '16px', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setShowNewRoutine(false); setNewRoutineName('') }}
                style={{ flex: 1, padding: '12px', border: '1px solid #222', color: '#b8b8b8', fontSize: '12px', fontWeight: 700, borderRadius: '12px', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                onClick={createRoutine}
                disabled={!newRoutineName.trim() || creatingRoutine}
                style={{ flex: 1, padding: '12px', background: '#3ecf8e', color: '#0a0a0a', fontSize: '12px', fontWeight: 700, borderRadius: '12px', border: 'none', cursor: 'pointer', opacity: !newRoutineName.trim() || creatingRoutine ? 0.4 : 1, fontFamily: 'inherit' }}
              >
                {creatingRoutine ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
