'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeMuscleSplit } from '@/lib/muscleMap'
import WorkoutHistory from './WorkoutHistory'

interface Routine {
  id: string
  name: string
  exerciseCount: number
  is_system: boolean
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

// ── 3-day template ────────────────────────────────────────────────────────────
const THREE_DAY_TEMPLATE = [
  {
    name: 'Upper A',
    exercises: [
      { exercise_name: 'Barbell Bench Press',   sets_target: 3, reps_min: 5,  reps_max: 8,  rest_seconds: 180, exercise_order: 1 },
      { exercise_name: 'Barbell Row',           sets_target: 3, reps_min: 5,  reps_max: 8,  rest_seconds: 180, exercise_order: 2 },
      { exercise_name: 'Incline Dumbbell Press',sets_target: 3, reps_min: 8,  reps_max: 12, rest_seconds: 150, exercise_order: 3 },
      { exercise_name: 'Cable Row',             sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 120, exercise_order: 4 },
      { exercise_name: 'Lateral Raise',         sets_target: 3, reps_min: 12, reps_max: 15, rest_seconds: 90,  exercise_order: 5 },
      { exercise_name: 'Tricep Pushdown',       sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 90,  exercise_order: 6 },
    ],
  },
  {
    name: 'Upper B',
    exercises: [
      { exercise_name: 'Overhead Press', sets_target: 3, reps_min: 5,  reps_max: 8,  rest_seconds: 180, exercise_order: 1 },
      { exercise_name: 'Pull-Up',        sets_target: 3, reps_min: 5,  reps_max: 8,  rest_seconds: 180, exercise_order: 2 },
      { exercise_name: 'Machine Row',    sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 150, exercise_order: 3 },
      { exercise_name: 'Face Pull',      sets_target: 3, reps_min: 15, reps_max: 20, rest_seconds: 90,  exercise_order: 4 },
      { exercise_name: 'Bicep Curl',     sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 90,  exercise_order: 5 },
    ],
  },
  {
    name: 'Lower A',
    exercises: [
      { exercise_name: 'Bulgarian Split Squat', sets_target: 3, reps_min: 8,  reps_max: 12, rest_seconds: 180, exercise_order: 1 },
      { exercise_name: 'Hip Thrust',            sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 150, exercise_order: 2 },
      { exercise_name: 'Lying Leg Curl',        sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 120, exercise_order: 3 },
      { exercise_name: 'Leg Extension',         sets_target: 3, reps_min: 12, reps_max: 15, rest_seconds: 120, exercise_order: 4 },
      { exercise_name: 'Calf Raise',            sets_target: 4, reps_min: 15, reps_max: 20, rest_seconds: 90,  exercise_order: 5 },
    ],
  },
]

// ── Main component ────────────────────────────────────────────────────────────
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
      const newRoutines: Routine[] = []
      for (const tpl of THREE_DAY_TEMPLATE) {
        const { data: routine, error } = await supabase
          .from('routines')
          .insert({ user_id: userId, name: tpl.name })
          .select('id')
          .single()
        if (error || !routine) continue
        await supabase
          .from('routine_exercises')
          .insert(tpl.exercises.map(ex => ({ ...ex, routine_id: routine.id })))
        newRoutines.push({ id: routine.id, name: tpl.name, exerciseCount: tpl.exercises.length, is_system: false })
      }
      setRoutines(prev => [...prev, ...newRoutines])
    } finally {
      setLoadingTemplate(false)
    }
  }

  const handleDelete = async (routineId: string) => {
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
      setRoutines(prev => [...prev, { id: data.id, name: newRoutineName.trim(), exerciseCount: 0, is_system: false }])
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
                {tab === 'routines' ? 'Routines' : 'History'}
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

      {/* ── Routines tab ──────────────────────────────────────── */}
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

          {/* My routines section */}
          <div style={{ ...sectionLabel, marginTop: lastWorkout ? '4px' : 0 }}>My routines</div>

          {routines.length === 0 ? (
            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
              <p style={{ color: '#b8b8b8', fontSize: '13px', marginBottom: '16px' }}>
                No routines yet. Load the recommended 3-day program or create your own.
              </p>
              <button
                onClick={loadTemplate}
                disabled={loadingTemplate}
                style={{ background: '#3ecf8e', color: '#0a0a0a', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: loadingTemplate ? 0.4 : 1, fontFamily: 'inherit' }}
              >
                {loadingTemplate ? 'Loading...' : '↓ Load Recommended 3-Day Program'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {routines.map(r => {
                const isLastDone = r.name === lastWorkout?.routineName
                const tags = getRoutineTags(r.name)
                return (
                  <div
                    key={r.id}
                    style={{
                      background: '#141414',
                      border: `1px solid ${isLastDone ? '#1a3528' : '#1e1e1e'}`,
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
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.3px' }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#b8b8b8', marginTop: '2px' }}>
                        {r.exerciseCount} exercises
                      </div>
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

                    {/* Delete control — only for non-system routines */}
                    {!r.is_system && (
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
                        background: '#3ecf8e',
                        color: '#0a0a0a',
                        border: 'none',
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
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="#0a0a0a">
                            <polygon points="5,3 19,12 5,21" />
                          </svg>
                          Start
                        </>
                      )}
                    </button>
                  </div>
                )
              })}

              {/* New routine dashed card */}
              <div
                onClick={() => setShowNewRoutine(true)}
                style={{
                  background: 'transparent',
                  border: '1px dashed #222',
                  borderRadius: '12px',
                  minHeight: '140px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '24px', color: '#252525', fontWeight: 300, lineHeight: 1 }}>+</div>
                <div style={{ fontSize: '12px', color: '#2e2e2e', fontWeight: 600 }}>New routine</div>
                <div style={{ fontSize: '10px', color: '#252525' }}>Build from scratch</div>
              </div>
            </div>
          )}

          {/* Start empty workout */}
          <button
            onClick={() => startWorkout()}
            disabled={starting !== null}
            style={{
              background: 'none',
              border: '1px solid #1a1a1a',
              borderRadius: '10px',
              padding: '14px',
              color: '#b8b8b8',
              fontSize: '13px',
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

      {/* ── New Routine modal ─────────────────────────────────── */}
      {showNewRoutine && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)' }}>
          <div style={{ width: '100%', background: '#0d0d0d', borderTop: '1px solid #222', borderRadius: '16px 16px 0 0', padding: '24px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '16px' }}>New Routine</p>
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
