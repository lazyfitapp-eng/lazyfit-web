'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

type GoalKey = 'cut' | 'recomp' | 'lean_bulk'
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active' | 'athlete'
type EditField = 'age' | 'sex' | 'height' | null

interface ProfileData {
  first_name: string | null
  last_name: string | null
  goal: GoalKey | null
  target_calories: number | null
  target_protein: number | null
  target_carbs: number | null
  target_fat: number | null
  age: number | null
  sex: string | null
  height_cm: number | null
  preferred_units: string | null
  activity_level: string | null
  training_days_per_week: number | null
  neck_cm: number | null
  waist_cm: number | null
  current_weight: number | null
  subscription_status: string | null
  body_fat_pct?: number | null
}

interface Props {
  user: { id: string; email?: string | undefined }
  profile: ProfileData | null
}

// ─── Goals config ─────────────────────────────────────────────────────────────

interface GoalConfig {
  label: string
  tagline: string
  accentColor: string
  cardBg: string
  cardBorder: string
  descBg: string
  descBorder: string
  desc: string
  coach: string
}

const GOALS: Record<GoalKey, GoalConfig> = {
  cut: {
    label: 'Cut',
    tagline: 'CUT · DAILY TARGET',
    accentColor: '#f5a623',
    cardBg: '#110d00',
    cardBorder: 'rgba(245,166,35,0.2)',
    descBg: '#110d00',
    descBorder: '#f5a623',
    desc: 'Calibrated for <strong style="color:#f0f0f0;">−0.4 kg/week</strong> fat loss. Protein is maximised to preserve every kg of muscle you\'ve built.',
    coach: '"Cut phases work when protein stays high and training stays heavy. Don\'t drop calories too fast — slow and steady preserves muscle."',
  },
  recomp: {
    label: 'Recomp',
    tagline: 'RECOMP · DAILY TARGET',
    accentColor: '#4a9eff',
    cardBg: '#080f1a',
    cardBorder: 'rgba(74,158,255,0.2)',
    descBg: '#080f1a',
    descBorder: '#4a9eff',
    desc: 'Maintenance calories — lose fat and gain muscle simultaneously. Slower results, but no trade-offs.',
    coach: '"Recomp is a patience game. Hit your protein every day and keep training hard — the body will handle the rest. Don\'t expect the scale to move much."',
  },
  lean_bulk: {
    label: 'Lean Bulk',
    tagline: 'LEAN BULK · DAILY TARGET',
    accentColor: '#3ecf8e',
    cardBg: '#0c1c12',
    cardBorder: 'rgba(62,207,142,0.15)',
    descBg: '#0c1c12',
    descBorder: '#3ecf8e',
    desc: 'Calibrated for <strong style="color:#f0f0f0;">+0.3 kg/week</strong> lean muscle gain. Protein stays high to protect muscle while you build.',
    coach: '"Lean bulking works when the surplus is small and training intensity is high. You\'re already on the right track."',
  },
}

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; sub: string; segments: number }[] = [
  { value: 'sedentary',   label: 'Sedentary',         sub: 'Desk job, minimal movement outside gym',         segments: 1 },
  { value: 'light',       label: 'Lightly active',    sub: 'Light walking, mostly seated work',               segments: 2 },
  { value: 'moderate',    label: 'Moderately active', sub: 'Regular walking, active job or lifestyle',        segments: 3 },
  { value: 'very_active', label: 'Very active',       sub: 'Physical job, lots of daily movement',           segments: 4 },
  { value: 'athlete',     label: 'Athlete',           sub: 'Training twice daily or extremely demanding job', segments: 5 },
]

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  very_active: 1.725,
  athlete:     1.9,
}

// ─── Macro calculation ────────────────────────────────────────────────────────

function calcMacros(
  goal: GoalKey,
  weightKg: number,
  heightCm: number,
  age: number,
  sex: string,
  activityLevel: ActivityLevel,
) {
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex.toLowerCase() === 'male' ? 5 : -161)
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel]
  const adjusted = goal === 'cut' ? tdee - 400 : goal === 'lean_bulk' ? tdee + 250 : tdee
  const protein = Math.round(weightKg * 2.0)
  const fat = Math.round((adjusted * 0.25) / 9)
  const carbs = Math.round((adjusted - protein * 4 - fat * 9) / 4)
  return { kcal: Math.round(adjusted), protein, fat, carbs }
}

function activitySegments(level: ActivityLevel): number {
  return ACTIVITY_OPTIONS.find(o => o.value === level)?.segments ?? 2
}

function activityLabel(level: ActivityLevel): string {
  return ACTIVITY_OPTIONS.find(o => o.value === level)?.label ?? 'Lightly active'
}

// ─── Animations (injected once) ───────────────────────────────────────────────

const KEYFRAMES = `
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes pulseGreen { 0%,100% { box-shadow:0 0 0 0 rgba(62,207,142,0); } 50% { box-shadow:0 0 0 6px rgba(62,207,142,0.12); } }
`

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileClient({ user, profile }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // ── State ──
  const [goal, setGoal] = useState<GoalKey>((profile?.goal as GoalKey) ?? 'lean_bulk')
  const [pendingGoal, setPendingGoal] = useState<GoalKey | null>(null)
  const [trainingDays, setTrainingDays] = useState(profile?.training_days_per_week ?? 3)
  const [units, setUnits] = useState<'kg' | 'lbs'>(profile?.preferred_units === 'lbs' ? 'lbs' : 'kg')
  const [age, setAge] = useState(profile?.age ?? 0)
  const [sex, setSex] = useState(profile?.sex ?? 'Male')
  const [heightCm, setHeightCm] = useState(profile?.height_cm ?? 0)
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    (profile?.activity_level as ActivityLevel) ?? 'light'
  )
  const [neckCm, setNeckCm] = useState<number | null>(profile?.neck_cm ?? null)
  const [editDrawer, setEditDrawer] = useState<EditField>(null)
  const [actSheetOpen, setActSheetOpen] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [editSex, setEditSex] = useState(profile?.sex ?? 'Male')
  const [editInputVal, setEditInputVal] = useState('')
  const [pulsing, setPulsing] = useState(false)

  // Computed macros
  const weightKg = profile?.current_weight ?? 80
  const hasSufficientData = age > 0 && heightCm > 0 && weightKg > 0
  const macros = hasSufficientData
    ? calcMacros(goal, weightKg, heightCm, age, sex, activityLevel)
    : null

  // Animated kcal value
  const [displayKcal, setDisplayKcal] = useState(macros?.kcal ?? profile?.target_calories ?? 2000)
  const kcalAnimRef = useRef<number | null>(null)

  const animateKcal = useCallback((from: number, to: number) => {
    if (kcalAnimRef.current) cancelAnimationFrame(kcalAnimRef.current)
    const start = performance.now()
    const duration = 500
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplayKcal(Math.round(from + (to - from) * ease))
      if (progress < 1) kcalAnimRef.current = requestAnimationFrame(step)
    }
    kcalAnimRef.current = requestAnimationFrame(step)
  }, [])

  // Confidence bar: rough estimate based on whether we have real data
  const weeksOfData = profile?.current_weight ? 12 : 0
  const confidencePct = Math.min(100, weeksOfData * 8)
  const confidenceLabel = weeksOfData >= 8
    ? `Good · ${weeksOfData} weeks of data`
    : weeksOfData > 0
    ? `Building · ${weeksOfData} weeks of data`
    : 'New estimate'

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user.email || 'You'
  const isFoundingMember = profile?.subscription_status !== 'paid'

  // ── Handlers ──

  function openGoalConfirm(g: GoalKey) {
    if (g === goal) return
    setPendingGoal(g)
    setConfirmModalOpen(true)
  }

  async function confirmGoalSwitch() {
    if (!pendingGoal) return
    const newMacros = hasSufficientData
      ? calcMacros(pendingGoal, weightKg, heightCm, age, sex, activityLevel)
      : null
    const prevKcal = displayKcal
    setGoal(pendingGoal)
    setPendingGoal(null)
    setConfirmModalOpen(false)
    if (newMacros) {
      animateKcal(prevKcal, newMacros.kcal)
      setPulsing(true)
      setTimeout(() => setPulsing(false), 900)
    }
    const updates: Record<string, unknown> = { goal: pendingGoal }
    if (newMacros) {
      updates.target_calories = newMacros.kcal
      updates.target_protein  = newMacros.protein
      updates.target_carbs    = newMacros.carbs
      updates.target_fat      = newMacros.fat
    }
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (error) console.error('Goal update failed:', error.message)
  }

  async function saveEditField() {
    if (!editDrawer) return
    const updates: Record<string, unknown> = {}
    if (editDrawer === 'age') {
      const v = parseInt(editInputVal)
      if (!v || v < 16 || v > 80) return
      setAge(v)
      updates.age = v
    } else if (editDrawer === 'height') {
      const v = parseFloat(editInputVal)
      if (!v || v < 140 || v > 220) return
      setHeightCm(v)
      updates.height_cm = v
    } else if (editDrawer === 'sex') {
      setSex(editSex)
      updates.sex = editSex
    }
    setEditDrawer(null)
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (error) console.error('Profile update failed:', error.message)
  }

  async function saveActivityLevel(level: ActivityLevel) {
    setActivityLevel(level)
    setActSheetOpen(false)
    const { error } = await supabase.from('profiles').update({ activity_level: level }).eq('id', user.id)
    if (error) console.error('Activity update failed:', error.message)
  }

  async function saveTrainingDays(days: number) {
    setTrainingDays(days)
    const { error } = await supabase.from('profiles').update({ training_days_per_week: days }).eq('id', user.id)
    if (error) console.error('Training days update failed:', error.message)
  }

  async function saveUnits(u: 'kg' | 'lbs') {
    setUnits(u)
    const { error } = await supabase.from('profiles').update({ preferred_units: u }).eq('id', user.id)
    if (error) console.error('Units update failed:', error.message)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function openEditDrawer(field: EditField) {
    setEditInputVal(field === 'age' ? String(age) : field === 'height' ? String(heightCm) : '')
    setEditSex(sex)
    setEditDrawer(field)
  }

  // Keep displayKcal in sync when macros change (not via goal switch)
  useEffect(() => {
    if (macros) setDisplayKcal(macros.kcal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityLevel, heightCm, age, sex])

  const activeGoal = GOALS[goal]
  const pendingGoalData = pendingGoal ? GOALS[pendingGoal] : null
  const currentMacros = macros ?? {
    kcal: profile?.target_calories ?? 0,
    protein: profile?.target_protein ?? 0,
    carbs: profile?.target_carbs ?? 0,
    fat: profile?.target_fat ?? 0,
  }

  // ── Render ──

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif', background: '#090909', maxWidth: 430, margin: '0 auto', minHeight: '100vh', paddingBottom: 100 }}>
      <style>{KEYFRAMES}</style>

      {/* Header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#f0f0f0' }}>Profile</span>
      </div>

      {/* Identity */}
      <div style={{ padding: '18px 20px 24px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.15, color: '#f0f0f0' }}>{displayName}</div>
        <div style={{ fontSize: 13, color: '#b8b8b8', marginTop: 3 }}>{user.email}</div>
        {isFoundingMember && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.18)', borderRadius: 20, padding: '4px 12px' }}>
            <span style={{ fontSize: 11, lineHeight: 1 }}>🏆</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f5a623', letterSpacing: '0.8px' }}>FOUNDING MEMBER</span>
          </div>
        )}
      </div>

      {/* Goal + Nutrition block */}
      <div style={{ margin: '20px 16px 0' }}>
        <div style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 16, overflow: 'hidden' }}>

          {/* Goal selector */}
          <div style={{ padding: '14px 16px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#b8b8b8', letterSpacing: '0.8px', marginBottom: 10 }}>GOAL</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {(['cut', 'recomp', 'lean_bulk'] as GoalKey[]).map(g => {
                const cfg = GOALS[g]
                const active = goal === g
                return (
                  <div
                    key={g}
                    onClick={() => openGoalConfirm(g)}
                    style={{
                      border: active ? `1px solid ${cfg.accentColor}` : '1px solid #1a1a1a',
                      borderRadius: 12,
                      padding: '12px 8px',
                      textAlign: 'center',
                      background: active ? cfg.cardBg : '#111',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: cfg.accentColor, marginBottom: 3 }}>{cfg.label}</div>
                    <div style={{ fontSize: 10, color: active ? cfg.accentColor : '#b8b8b8', opacity: active ? 0.6 : 1, lineHeight: 1.3 }}>
                      {g === 'cut' ? '−400 kcal\nlose fat' : g === 'recomp' ? 'maintenance\nrecompose' : '+250 kcal\nbuild muscle'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Goal description */}
          <div style={{ margin: '0 16px 14px', padding: '11px 14px', background: activeGoal.descBg, borderRadius: 10, borderLeft: `2px solid ${activeGoal.descBorder}` }}>
            <div style={{ fontSize: 13, color: '#b8b8b8', lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: activeGoal.desc }} />
          </div>

          {/* Training days */}
          <div style={{ borderTop: '1px solid #1a1a1a', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, color: '#b8b8b8' }}>Training days / week</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span
                onClick={() => { const v = Math.max(1, trainingDays - 1); saveTrainingDays(v) }}
                style={{ fontSize: 22, color: '#b8b8b8', cursor: 'pointer', userSelect: 'none', padding: '0 4px' }}
              >−</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', minWidth: 20, textAlign: 'center' }}>{trainingDays}</span>
              <span
                onClick={() => { const v = Math.min(7, trainingDays + 1); saveTrainingDays(v) }}
                style={{ fontSize: 22, color: '#b8b8b8', cursor: 'pointer', userSelect: 'none', padding: '0 4px' }}
              >+</span>
            </div>
          </div>

          {/* Units toggle */}
          <div style={{ borderTop: '1px solid #1a1a1a', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, color: '#b8b8b8' }}>Units</span>
            <div style={{ display: 'flex', background: '#151515', borderRadius: 8, padding: 2, gap: 2 }}>
              {(['kg', 'lbs'] as const).map(u => (
                <div
                  key={u}
                  onClick={() => saveUnits(u)}
                  style={{
                    padding: '6px 18px',
                    fontSize: 13,
                    fontWeight: units === u ? 700 : 600,
                    background: units === u ? '#3ecf8e' : 'transparent',
                    color: units === u ? '#090909' : '#b8b8b8',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >{u}</div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Nutrition card */}
      <div style={{
        margin: '12px 16px 0',
        borderRadius: 16,
        padding: '16px 18px',
        background: activeGoal.cardBg,
        border: `1px solid ${activeGoal.cardBorder}`,
        animation: pulsing ? 'pulseGreen 0.8s ease-out' : 'none',
      }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: activeGoal.accentColor, letterSpacing: '0.8px' }}>{activeGoal.tagline}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 4 }}>
          <span style={{ fontSize: 38, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-1.5px', lineHeight: 1 }}>{displayKcal.toLocaleString()}</span>
          <span style={{ fontSize: 14, color: '#b8b8b8' }}>kcal / day</span>
        </div>

        {/* Confidence bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: '#2e5c3e' }}>Estimate accuracy</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#3ecf8e' }}>{confidenceLabel}</span>
          </div>
          <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${confidencePct}%`, background: '#3ecf8e', borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
        </div>

        {/* Macro grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div style={{ background: 'rgba(62,207,142,0.07)', border: '1px solid rgba(62,207,142,0.1)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#3ecf8e' }}>{currentMacros.protein}g</div>
            <div style={{ fontSize: 11, color: '#b8b8b8', marginTop: 2 }}>protein</div>
          </div>
          <div style={{ background: 'rgba(74,158,255,0.07)', border: '1px solid rgba(74,158,255,0.1)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#4a9eff' }}>{currentMacros.carbs}g</div>
            <div style={{ fontSize: 11, color: '#b8b8b8', marginTop: 2 }}>carbs</div>
          </div>
          <div style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.1)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f5a623' }}>{currentMacros.fat}g</div>
            <div style={{ fontSize: 11, color: '#b8b8b8', marginTop: 2 }}>fat</div>
          </div>
        </div>
      </div>

      {/* Body section */}
      <div style={{ padding: '14px 20px 4px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#b8b8b8', letterSpacing: '1px' }}>BODY</span>
      </div>
      <div style={{ margin: '8px 16px', background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 16, overflow: 'hidden' }}>

        {/* Age */}
        <div
          onClick={() => openEditDrawer('age')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 16px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 15, color: '#b8b8b8' }}>Age</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0' }}>{age || '—'}</span>
            <span style={{ fontSize: 18, color: '#b8b8b8' }}>›</span>
          </div>
        </div>

        {/* Sex */}
        <div
          onClick={() => openEditDrawer('sex')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 16px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 15, color: '#b8b8b8' }}>Sex</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0' }}>{sex || '—'}</span>
            <span style={{ fontSize: 18, color: '#b8b8b8' }}>›</span>
          </div>
        </div>

        {/* Height */}
        <div
          onClick={() => openEditDrawer('height')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 16px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 15, color: '#b8b8b8' }}>Height</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0' }}>{heightCm ? `${heightCm} cm` : '—'}</span>
            <span style={{ fontSize: 18, color: '#b8b8b8' }}>›</span>
          </div>
        </div>

        {/* Activity level */}
        <div
          onClick={() => setActSheetOpen(true)}
          style={{ borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 16px 8px' }}>
            <div>
              <div style={{ fontSize: 15, color: '#b8b8b8' }}>Activity level</div>
              <div style={{ fontSize: 11, color: '#3a3a3a', marginTop: 1 }}>Outside the gym — LazyFit knows your training</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0' }}>{activityLabel(activityLevel)}</span>
              <span style={{ fontSize: 18, color: '#b8b8b8' }}>›</span>
            </div>
          </div>
          <div style={{ margin: '0 16px 12px', display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ flex: 1, height: 4, background: i <= activitySegments(activityLevel) ? '#3ecf8e' : '#1a1a1a', borderRadius: 2 }} />
            ))}
          </div>
        </div>

        {/* Body fat */}
        <div style={{ padding: '15px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, color: '#b8b8b8' }}>Body fat</div>
              <div style={{ fontSize: 11, color: '#3a3a3a', marginTop: 1 }}>
                {neckCm ? 'Estimated from waist + neck' : 'Log neck measurement to unlock'}
              </div>
            </div>
            {neckCm ? (
              <span style={{ fontSize: 16, fontWeight: 800, color: '#f0f0f0' }}>{profile?.body_fat_pct ? `${profile.body_fat_pct}%` : '—'}</span>
            ) : (
              <span
                onClick={async () => {
                  const neck = parseFloat(prompt('Enter neck circumference (cm):') ?? '')
                  if (!neck || neck < 20 || neck > 60) return
                  setNeckCm(neck)
                  const { error } = await supabase.from('profiles').update({ neck_cm: neck }).eq('id', user.id)
                  if (error) console.error('Neck update failed:', error.message)
                }}
                style={{ fontSize: 13, fontWeight: 600, color: '#3ecf8e', cursor: 'pointer' }}
              >+ Log neck</span>
            )}
          </div>
        </div>

      </div>

      {/* Account section */}
      <div style={{ padding: '14px 20px 4px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#b8b8b8', letterSpacing: '1px' }}>ACCOUNT</span>
      </div>
      <div style={{ margin: '8px 16px', background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 16, overflow: 'hidden' }}>
        <a
          href="/privacy"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', textDecoration: 'none' }}
        >
          <span style={{ fontSize: 15, color: '#b8b8b8' }}>Privacy Policy</span>
          <span style={{ fontSize: 18, color: '#b8b8b8' }}>›</span>
        </a>
        <div
          onClick={handleSignOut}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 15, color: '#b8b8b8' }}>Sign out</span>
          <span style={{ fontSize: 18, color: '#b8b8b8' }}>›</span>
        </div>
        <div
          onClick={async () => {
            if (!confirm('Permanently delete your account and all data? This cannot be undone.')) return
            await supabase.from('profiles').delete().eq('id', user.id)
            await supabase.auth.signOut()
            router.push('/login')
          }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 15, color: '#e03e3e' }}>Delete account</span>
          <span style={{ fontSize: 18, color: '#b8b8b8' }}>›</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '20px 20px 4px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: '#2a2a2a' }}>LazyFit v1.0 · Your data is never sold</span>
      </div>

      {/* ── Overlays ── */}

      {/* Edit Drawer */}
      {editDrawer && (
        <div style={{ display: 'flex', position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: 430, height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 100, alignItems: 'flex-end' }}>
          <div style={{ background: '#0e0e0e', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', width: '100%', borderTop: '1px solid #1a1a1a', animation: 'slideUp 0.28s cubic-bezier(0.32,0.72,0,1)' }}>
            <div style={{ width: 36, height: 4, background: '#2a2a2a', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f0', marginBottom: 16 }}>
              {editDrawer === 'age' ? 'Edit age' : editDrawer === 'sex' ? 'Edit sex' : 'Edit height'}
            </div>
            <div style={{ marginBottom: 20 }}>
              {editDrawer === 'age' && (
                <>
                  <input
                    type="number"
                    value={editInputVal}
                    onChange={e => setEditInputVal(e.target.value)}
                    min={16} max={80}
                    style={{ width: '100%', padding: '14px 16px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, fontSize: 18, fontWeight: 600, color: '#f0f0f0', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                    autoFocus
                  />
                  <div style={{ fontSize: 12, color: '#3a3a3a', marginTop: 8, paddingLeft: 4 }}>Years old</div>
                </>
              )}
              {editDrawer === 'sex' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['Male', 'Female'] as const).map(s => (
                    <div
                      key={s}
                      onClick={() => setEditSex(s)}
                      style={{ padding: 16, textAlign: 'center', border: editSex === s ? '1.5px solid #3ecf8e' : '1px solid #1a1a1a', borderRadius: 12, cursor: 'pointer', background: editSex === s ? '#0c1c12' : '#111' }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 700, color: editSex === s ? '#3ecf8e' : '#f0f0f0' }}>{s}</div>
                    </div>
                  ))}
                </div>
              )}
              {editDrawer === 'height' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    value={editInputVal}
                    onChange={e => setEditInputVal(e.target.value)}
                    min={140} max={220}
                    style={{ flex: 1, padding: '14px 16px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, fontSize: 18, fontWeight: 600, color: '#f0f0f0', fontFamily: 'inherit', outline: 'none' }}
                    autoFocus
                  />
                  <span style={{ fontSize: 15, color: '#b8b8b8', fontWeight: 600 }}>cm</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditDrawer(null)} style={{ flex: 1, padding: 14, background: '#1a1a1a', border: 'none', borderRadius: 12, fontSize: 15, color: '#b8b8b8', fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveEditField} style={{ flex: 2, padding: 14, background: '#3ecf8e', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#090909', fontFamily: 'inherit', cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Sheet */}
      {actSheetOpen && (
        <div style={{ display: 'flex', position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: 430, height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 100, alignItems: 'flex-end' }}>
          <div style={{ background: '#0e0e0e', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', width: '100%', borderTop: '1px solid #1a1a1a', animation: 'slideUp 0.28s cubic-bezier(0.32,0.72,0,1)' }}>
            <div style={{ width: 36, height: 4, background: '#2a2a2a', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f0', marginBottom: 4 }}>Activity level</div>
            <div style={{ fontSize: 13, color: '#b8b8b8', marginBottom: 20 }}>Your lifestyle outside the gym. LazyFit already accounts for your training sessions.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {ACTIVITY_OPTIONS.map(opt => {
                const active = activityLevel === opt.value
                return (
                  <div
                    key={opt.value}
                    onClick={() => saveActivityLevel(opt.value)}
                    style={{ background: active ? '#0c1c12' : '#111', border: active ? '1.5px solid #3ecf8e' : '1px solid #1a1a1a', borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 15, fontWeight: active ? 700 : 600, color: active ? '#3ecf8e' : '#f0f0f0' }}>{opt.label}</div>
                      {active && <span style={{ fontSize: 10, fontWeight: 700, color: '#3ecf8e', background: 'rgba(62,207,142,0.1)', borderRadius: 6, padding: '3px 8px' }}>CURRENT</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#b8b8b8', marginTop: 2 }}>{opt.sub}</div>
                  </div>
                )
              })}
            </div>
            <button onClick={() => setActSheetOpen(false)} style={{ width: '100%', padding: 14, background: '#1a1a1a', border: 'none', borderRadius: 12, fontSize: 15, color: '#b8b8b8', fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Goal Confirm Modal */}
      {confirmModalOpen && pendingGoalData && (
        <div style={{ display: 'flex', position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: 430, height: '100vh', background: 'rgba(0,0,0,0.9)', zIndex: 200, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0e0e0e', borderRadius: 20, padding: '24px 20px 20px', width: 'calc(100% - 48px)', border: '1px solid #1a1a1a', animation: 'scaleIn 0.2s ease-out' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>Switch to {pendingGoalData.label}?</div>
            <div style={{ fontSize: 13, color: '#b8b8b8', marginBottom: 16 }}>Here&apos;s exactly what changes on your plan:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {(['Calories', 'Protein', 'Carbs', 'Fat'] as const).map((label, i) => {
                const fromVals = [currentMacros.kcal, currentMacros.protein, currentMacros.carbs, currentMacros.fat]
                const pendingMacros = hasSufficientData
                  ? calcMacros(pendingGoal!, weightKg, heightCm, age, sex, activityLevel)
                  : null
                const toVals = pendingMacros
                  ? [pendingMacros.kcal, pendingMacros.protein, pendingMacros.carbs, pendingMacros.fat]
                  : fromVals
                const suffix = i === 0 ? ' kcal' : 'g'
                return (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#111', borderRadius: 10 }}>
                    <span style={{ fontSize: 14, color: '#b8b8b8' }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, color: '#3a3a3a', textDecoration: 'line-through' }}>{fromVals[i].toLocaleString()}{suffix}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0' }}>{toVals[i].toLocaleString()}{suffix}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ padding: '12px 14px', background: '#0c1c12', borderRadius: 10, borderLeft: '2px solid #3ecf8e', marginBottom: 18 }}>
              <span style={{ fontSize: 13, color: '#b8b8b8', lineHeight: 1.6, fontStyle: 'italic' }}>{pendingGoalData.coach}</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setPendingGoal(null); setConfirmModalOpen(false) }} style={{ flex: 1, padding: 14, background: '#1a1a1a', border: 'none', borderRadius: 12, fontSize: 15, color: '#b8b8b8', fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmGoalSwitch} style={{ flex: 2, padding: 14, background: '#3ecf8e', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#090909', fontFamily: 'inherit', cursor: 'pointer' }}>Confirm switch</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
