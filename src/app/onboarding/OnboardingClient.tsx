'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createDefaultRoutines } from '@/lib/createDefaultRoutines'

// ── Types ──────────────────────────────────────────────────────────────────────

type Gender = 'Male' | 'Female'
type BFMethod = 'visual' | 'navy'
type JobActivity = 'desk' | 'feet' | 'labor'
type DailySteps = 'lt5k' | '5-10k' | '10-15k' | 'gt15k'
type Goal = 'recomp' | 'cut' | 'bulk'

interface FormState {
  firstName: string
  gender: Gender
  dob: string
  heightCm: string
  weightKg: string
  bodyFatPct: number
  bodyFatMethod: BFMethod
  neckCm: string
  waistCm: string
  jobActivity: JobActivity
  dailySteps: DailySteps
  goal: Goal
}

interface Macros {
  tdee: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const C = {
  bg: '#060606',
  surface: '#0d0d0d',
  surface2: '#131313',
  surface3: '#181818',
  border: '#1e1e1e',
  border2: '#262626',
  text: '#f2f2f2',
  text2: '#c8c8c8',
  text3: '#888888',
  green: '#3ecf8e',
  green2: '#2db87a',
  greenGlow: 'rgba(62,207,142,0.15)',
  greenBorder: 'rgba(62,207,142,0.2)',
  amber: '#f5a623',
  blue: '#4a9eff',
} as const

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
const MONO = '"SF Mono", "Fira Code", "Courier New", monospace'

// ── BF reference data ──────────────────────────────────────────────────────────

const BF_DATA = [
  { pct: 8,  label: 'Elite',     },
  { pct: 12, label: 'Lean',      },
  { pct: 15, label: 'Athletic',  },
  { pct: 18, label: 'Average',   },
  { pct: 22, label: 'Above avg', },
  { pct: 28, label: 'High',      },
  { pct: 35, label: 'Very high', },
] as const

const CTA_LABELS: Record<number, string> = {
  1: 'Tell me more →',
  2: 'Lock in my numbers →',
  3: 'Set my activity →',
  4: 'Set my goal →',
  5: "I'm ready.",
}

// ── Helper functions ───────────────────────────────────────────────────────────

function calcAge(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return Math.max(0, age)
}

function parseNumber(value: string): number | null {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function computeMacros(form: FormState): Macros {
  const w = parseFloat(form.weightKg) || 80
  const h = parseFloat(form.heightCm) || 175
  const age = form.dob ? calcAge(form.dob) : 30
  const isMale = form.gender === 'Male'

  const bmr = isMale
    ? 10 * w + 6.25 * h - 5 * age + 5
    : 10 * w + 6.25 * h - 5 * age - 161

  const jobMult: Record<JobActivity, number> = { desk: 1.2, feet: 1.375, labor: 1.55 }
  const stepMult: Record<DailySteps, number> = { lt5k: 0, '5-10k': 0.05, '10-15k': 0.1, gt15k: 0.175 }
  const tdee = Math.round(bmr * (jobMult[form.jobActivity] + stepMult[form.dailySteps]))

  const goalAdj: Record<Goal, number> = { recomp: 0, cut: -400, bulk: 250 }
  const calories = Math.max(1200, tdee + goalAdj[form.goal])

  const protein = Math.round(w * (form.goal === 'cut' ? 1.8 : 1.6))
  const fat = Math.round(w * 0.8)
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))

  return { tdee, calories, protein, carbs, fat }
}

function calcNavyBF(neck: number, waist: number, height: number, gender: Gender): number | null {
  if (!neck || !waist || !height || waist <= neck) return null
  let bf: number
  if (gender === 'Male') {
    bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450
  } else {
    bf = 495 / (1.29579 - 0.35004 * Math.log10(waist + 95 - neck) + 0.22100 * Math.log10(height)) - 450
  }
  if (!isFinite(bf)) return null
  return Math.max(5, Math.min(50, Math.round(bf * 10) / 10))
}

// ── Body silhouette SVG ────────────────────────────────────────────────────────

function BodySilhouette({ pct }: { pct: number }) {
  const fatness = Math.max(0, Math.min(1, (pct - 8) / 30))
  const w = 16 + fatness * 12
  const belly = 12 + fatness * 16
  const color = pct <= 12 ? '#3ecf8e' : pct <= 18 ? '#7a7a7a' : '#4a4a4a'
  const cx = 22
  return (
    <svg viewBox="0 0 44 56" fill="none" style={{ width: 44, height: 56, display: 'block', margin: '0 auto' }}>
      <ellipse cx={cx} cy={8} rx={7} ry={7.5} fill={color} opacity={0.7} />
      <path
        d={`M${cx - w / 2} 18 Q${cx - belly / 2} 32 ${cx - w / 2 + 2} 48 L${cx + w / 2 - 2} 48 Q${cx + belly / 2} 32 ${cx + w / 2} 18 Z`}
        fill={color} opacity={0.5}
      />
      <rect x={cx - w / 2 + 1} y={46} width={w / 2 - 2} height={10} rx={3} fill={color} opacity={0.4} />
      <rect x={cx + 2} y={46} width={w / 2 - 2} height={10} rx={3} fill={color} opacity={0.4} />
    </svg>
  )
}

// ── Count-up hook ──────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1100, delay = 0): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    setValue(0)
    const timer = setTimeout(() => {
      const start = performance.now()
      const tick = (now: number) => {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        const next = Math.round(target * eased)
        setValue(next)
        if (progress < 1) requestAnimationFrame(tick)
        else setValue(target)
      }
      requestAnimationFrame(tick)
    }, delay)
    return () => clearTimeout(timer)
  }, [target, duration, delay])
  return value
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OnboardingClient({ userId, email }: { userId: string; email: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [animKey, setAnimKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [calActive, setCalActive] = useState(false)
  const [macrosVisible, setMacrosVisible] = useState(false)

  const [form, setForm] = useState<FormState>({
    firstName: '',
    gender: 'Male',
    dob: '',
    heightCm: '',
    weightKg: '',
    bodyFatPct: 18,
    bodyFatMethod: 'visual',
    neckCm: '',
    waistCm: '',
    jobActivity: 'desk',
    dailySteps: '5-10k',
    goal: 'recomp',
  })

  const macros = computeMacros(form)
  const tdeeDisplay = useCountUp(step === 5 ? macros.tdee : 0, 1000, 200)
  const calsDisplay = useCountUp(step === 5 ? macros.calories : 0, 1000, 350)

  useEffect(() => {
    if (step === 5) {
      const t1 = setTimeout(() => setCalActive(true), 1000)
      const t2 = setTimeout(() => setMacrosVisible(true), 650)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    } else {
      setCalActive(false)
      setMacrosVisible(false)
    }
  }, [step])

  const navyBF = calcNavyBF(
    parseFloat(form.neckCm),
    parseFloat(form.waistCm),
    parseFloat(form.heightCm),
    form.gender,
  )

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const validateStep = (stepToValidate: number): string | null => {
    if (stepToValidate === 1) {
      const age = form.dob ? calcAge(form.dob) : null
      const height = parseNumber(form.heightCm)

      if (age == null || !Number.isFinite(age) || age < 13 || age > 90) {
        return 'Enter a valid date of birth. Age must be between 13 and 90.'
      }
      if (height == null || height < 120 || height > 230) {
        return 'Enter a valid height between 120 and 230 cm.'
      }
    }

    if (stepToValidate === 2) {
      const weight = parseNumber(form.weightKg)

      if (weight == null || weight < 35 || weight > 250) {
        return 'Enter a valid weight between 35 and 250 kg.'
      }
    }

    return null
  }

  const validateRequiredInputs = (): string | null =>
    validateStep(1) ?? validateStep(2)

  const goNext = () => {
    const validationError = validateStep(step)
    if (validationError) {
      setSubmitError(validationError)
      return
    }

    setSubmitError(null)
    if (step < 5) {
      setStep(s => s + 1)
      setAnimKey(k => k + 1)
    }
  }

  const goPrev = () => {
    if (step > 1) {
      setStep(s => s - 1)
      setAnimKey(k => k + 1)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const validationError = validateRequiredInputs()
      if (validationError) throw new Error(validationError)

      const bfFinal = form.bodyFatMethod === 'navy' && navyBF != null ? navyBF : form.bodyFatPct
      const age = form.dob ? calcAge(form.dob) : null

      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        first_name: form.firstName.trim() || null,
        sex: form.gender.toLowerCase(),
        date_of_birth: form.dob || null,
        age,
        height_cm: parseFloat(form.heightCm) || null,
        current_weight: parseFloat(form.weightKg) || null,
        body_fat_pct: bfFinal,
        job_activity: form.jobActivity,
        daily_steps: form.dailySteps,
        goal: form.goal,
        tdee_kcal: macros.tdee,
        target_calories: macros.calories,
        target_protein: macros.protein,
        target_carbs: macros.carbs,
        target_fat: macros.fat,
        onboarding_completed: false,
      })

      if (error) throw new Error(error.message)

      await createDefaultRoutines(supabase, userId)

      const { error: completeError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', userId)

      if (completeError) throw new Error(completeError.message)

      router.push('/dashboard')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setSubmitting(false)
    }
  }

  const progressPct = (step / 5) * 100

  // ── Input style ──────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 52,
    background: C.surface2,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    color: C.text,
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: 500,
    padding: '0 14px',
    outline: 'none',
    WebkitAppearance: 'none',
  }

  // ── Step content ─────────────────────────────────────────────────────────────

  const stepHero = (eyebrow: string, title: React.ReactNode, sub: React.ReactNode) => (
    <div style={{ marginBottom: 30 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 400, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.green, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 20, height: 1, background: C.green, display: 'block', flexShrink: 0 }} />
        {eyebrow}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 48, fontWeight: 800, lineHeight: 0.92, color: C.text, marginBottom: 12, letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, borderLeft: `2px solid ${C.border2}`, paddingLeft: 14, fontStyle: 'italic' }}>
        {sub}
      </div>
    </div>
  )

  const fieldLabel = (text: string, style?: React.CSSProperties) => (
    <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999', marginBottom: 8, ...style }}>
      {text}
    </div>
  )

  // ── Step 1: Identity ─────────────────────────────────────────────────────────

  const step1 = (
    <div style={{ paddingBottom: 24 }}>
      {stepHero(
        'Step 1 — Identity',
        <>YOU&apos;RE<br /><span style={{ color: 'rgba(62,207,142,0.18)', WebkitTextStroke: '1.4px rgba(62,207,142,0.85)', textShadow: '0 0 18px rgba(62,207,142,0.28)' }}>SERIOUS.</span><br />SO ARE WE.</>,
        <><strong style={{ color: C.text, fontStyle: 'normal' }}>Most fitness apps give you 90 days of confusion</strong> and hope you figure it out. LazyFit gives you <strong style={{ color: C.text, fontStyle: 'normal' }}>3 workouts a week</strong> and makes every single one count.</>
      )}

      {fieldLabel('First name')}
      <input
        style={{ ...inputStyle, marginBottom: 16 }}
        type="text"
        placeholder="Your name"
        autoComplete="given-name"
        value={form.firstName}
        onChange={e => set('firstName', e.target.value)}
      />

      {fieldLabel('Gender')}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['Male', 'Female'] as const).map(g => (
          <button
            key={g}
            onClick={() => set('gender', g)}
            style={{
              flex: 1, height: 52,
              background: form.gender === g ? C.greenGlow : C.surface2,
              border: `1.5px solid ${form.gender === g ? C.green : C.border}`,
              borderRadius: 12,
              color: form.gender === g ? C.green : C.text2,
              fontFamily: FONT, fontSize: 15, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            {g === 'Male' ? (
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx={10} cy={14} r={5}/><path d="M19 5l-5.5 5.5M19 5h-5M19 5v5"/></svg>
            ) : (
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx={12} cy={9} r={5}/><path d="M12 14v7M9 18h6"/></svg>
            )}
            {g}
          </button>
        ))}
      </div>

      {fieldLabel('Date of birth')}
      <input
        style={{ ...inputStyle, marginBottom: 16, colorScheme: 'dark' }}
        type="date"
        value={form.dob}
        onChange={e => set('dob', e.target.value)}
      />

      {fieldLabel('Height')}
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...inputStyle, paddingRight: 48 }}
          type="number"
          placeholder="175"
          value={form.heightCm}
          onChange={e => set('heightCm', e.target.value)}
        />
        <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: MONO, fontSize: 12, color: C.text3, pointerEvents: 'none' }}>cm</span>
      </div>
    </div>
  )

  // ── Step 2: Body ─────────────────────────────────────────────────────────────

  const activeBFCard = BF_DATA.findIndex((d, i) =>
    form.bodyFatPct >= d.pct && (i === BF_DATA.length - 1 || form.bodyFatPct < BF_DATA[i + 1].pct)
  )

  const step2 = (
    <div style={{ paddingBottom: 24 }}>
      {stepHero(
        'Step 2 — Body',
        <>HONEST<br />NUMBERS<br /><span style={{ color: 'rgba(62,207,142,0.18)', WebkitTextStroke: '1.4px rgba(62,207,142,0.85)', textShadow: '0 0 18px rgba(62,207,142,0.28)' }}>ONLY.</span></>,
        <><strong style={{ color: C.text, fontStyle: 'normal' }}>This is the part nobody likes.</strong> But your body composition is the difference between targets that work and months of spinning your wheels.</>
      )}

      {fieldLabel('Current weight')}
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <input
          style={{ ...inputStyle, paddingRight: 48 }}
          type="number"
          placeholder="80"
          value={form.weightKg}
          onChange={e => set('weightKg', e.target.value)}
        />
        <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: MONO, fontSize: 12, color: C.text3, pointerEvents: 'none' }}>kg</span>
      </div>

      {fieldLabel('Body fat estimate')}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {(['visual', 'navy'] as const).map(m => (
          <button
            key={m}
            onClick={() => set('bodyFatMethod', m)}
            style={{
              flex: 1, height: 36,
              background: form.bodyFatMethod === m ? C.greenGlow : C.surface2,
              border: `1px solid ${form.bodyFatMethod === m ? C.greenBorder : C.border}`,
              borderRadius: 8,
              color: form.bodyFatMethod === m ? C.green : C.text2,
              fontFamily: FONT, fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {m === 'visual' ? 'Visual' : 'Navy Method ↗'}
          </button>
        ))}
      </div>

      {form.bodyFatMethod === 'visual' && (
        <>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 14 }}>
            {BF_DATA.map((d, i) => (
              <div
                key={d.pct}
                onClick={() => set('bodyFatPct', d.pct)}
                style={{
                  flexShrink: 0, width: 72,
                  background: activeBFCard === i ? C.greenGlow : C.surface2,
                  border: `1.5px solid ${activeBFCard === i ? C.green : C.border}`,
                  borderRadius: 10, padding: '10px 6px',
                  cursor: 'pointer', textAlign: 'center',
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: activeBFCard === i ? C.green : C.text2, marginBottom: 6 }}>{d.pct}%</div>
                <BodySilhouette pct={d.pct} />
                <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 6 }}>{d.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <input
              type="range"
              min={5} max={40}
              value={form.bodyFatPct}
              onChange={e => set('bodyFatPct', parseInt(e.target.value))}
              style={{ flex: 1, accentColor: C.green, height: 3, cursor: 'pointer' }}
            />
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 500, color: C.green, minWidth: 40, textAlign: 'right' }}>{form.bodyFatPct}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.text3 }}>5%</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.text3 }}>Very lean → High</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.text3 }}>40%</span>
          </div>
        </>
      )}

      {form.bodyFatMethod === 'navy' && (
        <>
          <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderLeft: `2px solid ${C.green}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>
              <strong style={{ color: C.text, fontWeight: 600 }}>US Navy Formula</strong> — used to assess military recruits since 1984. Accurate to within 3% of DEXA scans for most people.
            </p>
            <p style={{ fontSize: 11, color: C.text3, marginTop: 4, fontStyle: 'italic' }}>
              Neck: measure at the narrowest point, below the larynx. Waist: measure at the narrowest point, usually above the navel.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              {fieldLabel('Neck circumference')}
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 48 }}
                  type="number"
                  placeholder="38"
                  value={form.neckCm}
                  onChange={e => set('neckCm', e.target.value)}
                />
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: MONO, fontSize: 12, color: C.text3, pointerEvents: 'none' }}>cm</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {fieldLabel('Waist circumference')}
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 48 }}
                  type="number"
                  placeholder="85"
                  value={form.waistCm}
                  onChange={e => set('waistCm', e.target.value)}
                />
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: MONO, fontSize: 12, color: C.text3, pointerEvents: 'none' }}>cm</span>
              </div>
            </div>
          </div>
          {navyBF != null && (
            <div style={{ background: C.greenGlow, border: `1px solid ${C.greenBorder}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <span style={{ fontSize: 13, color: C.text2 }}>Calculated body fat</span>
              <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 500, color: C.green }}>{navyBF}%</span>
            </div>
          )}
        </>
      )}
    </div>
  )

  // ── Step 3: Activity ─────────────────────────────────────────────────────────

  const jobOptions = [
    { value: 'desk' as JobActivity, title: 'Desk job', desc: 'Office, remote work, studying — mostly sitting throughout the day.' },
    { value: 'feet' as JobActivity, title: 'On your feet', desc: 'Retail, teaching, healthcare — standing and moving most of the day.' },
    { value: 'labor' as JobActivity, title: 'Physical labor', desc: 'Construction, warehouse, trades — physically demanding from start to finish.' },
  ]

  const stepsOptions = [
    { value: 'lt5k' as DailySteps, num: '< 5,000', lbl: 'Mostly sedentary' },
    { value: '5-10k' as DailySteps, num: '5 – 10k', lbl: 'Lightly active' },
    { value: '10-15k' as DailySteps, num: '10 – 15k', lbl: 'Moderately active' },
    { value: 'gt15k' as DailySteps, num: '> 15k', lbl: 'Very active' },
  ]

  const step3 = (
    <div style={{ paddingBottom: 24 }}>
      {stepHero(
        'Step 3 — Daily Life',
        <>HOW YOU<br /><span style={{ color: 'transparent', WebkitTextStroke: `1px ${C.greenBorder}` }}>MOVE.</span></>,
        <>Outside the gym. <strong style={{ color: C.text, fontStyle: 'normal' }}>Most people get this wrong</strong> — either overestimating or underestimating. Check your Health app for your actual step count before you answer.</>
      )}

      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999', marginBottom: 10 }}>Your job</div>
      {jobOptions.map(opt => (
        <div
          key={opt.value}
          onClick={() => set('jobActivity', opt.value)}
          style={{
            background: form.jobActivity === opt.value ? C.greenGlow : C.surface2,
            border: `1.5px solid ${form.jobActivity === opt.value ? C.green : C.border}`,
            borderRadius: 12, padding: '14px 16px', marginBottom: 8,
            cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start',
          }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            border: `1.5px solid ${form.jobActivity === opt.value ? C.green : C.border2}`,
            background: form.jobActivity === opt.value ? C.green : 'transparent',
            flexShrink: 0, marginTop: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {form.jobActivity === opt.value && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#000' }} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: form.jobActivity === opt.value ? C.green : C.text, marginBottom: 2 }}>{opt.title}</div>
            <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.4 }}>{opt.desc}</div>
          </div>
        </div>
      ))}

      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999', marginBottom: 10, marginTop: 22 }}>Daily steps — outside the gym</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {stepsOptions.map(opt => (
          <div
            key={opt.value}
            onClick={() => set('dailySteps', opt.value)}
            style={{
              background: form.dailySteps === opt.value ? C.greenGlow : C.surface2,
              border: `1.5px solid ${form.dailySteps === opt.value ? C.green : C.border}`,
              borderRadius: 12, padding: 14,
              cursor: 'pointer',
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 500, color: form.dailySteps === opt.value ? C.green : C.text, marginBottom: 2 }}>{opt.num}</div>
            <div style={{ fontSize: 11, color: C.text2 }}>{opt.lbl}</div>
          </div>
        ))}
      </div>
    </div>
  )

  // ── Step 4: Goal ─────────────────────────────────────────────────────────────

  const goalOptions = [
    {
      value: 'recomp' as Goal,
      name: 'RECOMP',
      tag: 'Recommended',
      truth: <>Build muscle and lose fat simultaneously. <strong style={{ color: C.text, fontStyle: 'normal' }}>You&apos;ll never look worse.</strong> Progress is slower but the direction never reverses. Best for most people reading this.</>,
      stats: [{ val: 'Maintenance', lbl: 'Calories' }, { val: 'Slow & permanent', lbl: 'Rate' }],
    },
    {
      value: 'cut' as Goal,
      name: 'CUT',
      tag: '−400 kcal',
      truth: <>Lose fat, keep muscle. <strong style={{ color: C.text, fontStyle: 'normal' }}>Training will feel harder on a deficit.</strong> The result is worth it — but only if you&apos;re consistent. Best if you&apos;re above 15% body fat.</>,
      stats: [{ val: 'Deficit', lbl: 'Calories' }, { val: '~0.5kg/week', lbl: 'Target loss' }],
    },
    {
      value: 'bulk' as Goal,
      name: 'LEAN BULK',
      tag: '+250 kcal',
      truth: <>Maximum muscle with minimum fat gain. <strong style={{ color: C.text, fontStyle: 'normal' }}>You will gain some fat — that&apos;s the deal.</strong> Worth it only if you&apos;re already lean. Under 15% body fat.</>,
      stats: [{ val: 'Surplus', lbl: 'Calories' }, { val: '~0.2kg/week', lbl: 'Target gain' }],
    },
  ]

  const step4 = (
    <div style={{ paddingBottom: 24 }}>
      {stepHero(
        'Step 4 — Commitment',
        <>WHAT<br />DO YOU<br /><span style={{ color: 'rgba(62,207,142,0.18)', WebkitTextStroke: '1.4px rgba(62,207,142,0.85)', textShadow: '0 0 18px rgba(62,207,142,0.28)' }}>WANT?</span></>,
        <><strong style={{ color: C.text, fontStyle: 'normal' }}>Be honest with yourself here.</strong> Pick the goal for where you are right now — not where you want to be. You can change this in 8 weeks.</>
      )}

      {goalOptions.map(opt => {
        const on = form.goal === opt.value
        return (
          <div
            key={opt.value}
            onClick={() => set('goal', opt.value)}
            style={{
              background: on ? C.greenGlow : C.surface2,
              border: `1.5px solid ${on ? C.green : C.border}`,
              borderRadius: 14, padding: '18px 18px 16px', marginBottom: 10,
              cursor: 'pointer',
              transform: on ? 'translateY(-1px)' : 'none',
              boxShadow: on ? '0 4px 24px rgba(62,207,142,0.08)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontFamily: FONT, fontSize: 28, fontWeight: 800, letterSpacing: '0.04em', color: on ? C.green : C.text, lineHeight: 1 }}>{opt.name}</div>
              <div style={{
                fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: 6,
                background: on ? 'rgba(62,207,142,0.1)' : C.surface3,
                border: `1px solid ${on ? C.greenBorder : C.border2}`,
                color: on ? C.green : C.text3, marginTop: 4,
              }}>{opt.tag}</div>
            </div>
            <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.55, marginBottom: 12, fontStyle: 'italic' }}>{opt.truth}</div>
            <div style={{ display: 'flex', gap: 20 }}>
              {opt.stats.map(s => (
                <div key={s.lbl}>
                  <div style={{ fontFamily: MONO, fontSize: 13, color: on ? C.green : C.text2 }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )

  // ── Step 5: Reveal ────────────────────────────────────────────────────────────

  const goalSentences: Record<Goal, string> = {
    recomp: `That's maintenance — your body will recompose gradually at this intake.`,
    cut: `That's a 400 kcal deficit. At this rate, you'll lose ~0.5 kg per week.`,
    bulk: `That's a 250 kcal surplus. Expect ~0.2 kg of lean mass per week.`,
  }

  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  const ACTIVE_DAYS = ['MON', 'WED', 'FRI']

  const step5 = (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: '8px 0 28px' }}>
        <div style={{ fontFamily: FONT, fontSize: 60, fontWeight: 900, lineHeight: 0.88, letterSpacing: '-0.01em', marginBottom: 10, textTransform: 'uppercase' }}>
          <span style={{ color: C.green, display: 'block' }}>{(form.firstName.trim() || 'YOU') + '.'}</span>
          <span style={{ color: C.text, display: 'block' }}>YOUR<br />PROGRAM.</span>
        </div>
        <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, fontStyle: 'italic', borderLeft: `2px solid ${C.border2}`, paddingLeft: 12 }}>
          Built for your body. Calibrated to your goal. No guesswork left.
        </div>
      </div>

      {/* Numbers block */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginBottom: 12, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent 0%, ${C.green} 50%, transparent 100%)`, opacity: 0.4 }} />
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999', marginBottom: 14 }}>Daily targets</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: '#c0c0c0' }}>Estimated TDEE</span>
          <span style={{ fontFamily: MONO, fontSize: 18, color: C.text }}>{tdeeDisplay > 0 ? `${tdeeDisplay} kcal` : '—'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: '#c0c0c0' }}>Your daily calories</span>
          <span style={{ fontFamily: MONO, fontSize: 22, color: C.green }}>{calsDisplay > 0 ? `${calsDisplay} kcal` : '—'}</span>
        </div>
        <div style={{ fontSize: 13, color: '#aaa', marginBottom: 16, lineHeight: 1.5, fontStyle: 'italic' }}>
          {goalSentences[form.goal]}
        </div>
        <div style={{ height: 1, background: C.border, margin: '14px 0' }} />
        <div style={{ display: 'flex', gap: 8, opacity: macrosVisible ? 1 : 0, transition: 'opacity 0.4s ease' }}>
          {[
            { val: `${macros.protein}g`, lbl: 'Protein', color: C.green },
            { val: `${macros.carbs}g`,   lbl: 'Carbs',   color: C.blue },
            { val: `${macros.fat}g`,     lbl: 'Fat',     color: C.amber },
          ].map(m => (
            <div key={m.lbl} style={{ flex: 1, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 22, color: m.color, marginBottom: 2, display: 'block' }}>{m.val}</span>
              <span style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Routine block */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999' }}>Your routine</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.green, background: C.greenGlow, border: `1px solid ${C.greenBorder}`, borderRadius: 6, padding: '2px 8px' }}>3× per week</span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {DAYS.map(d => {
            const active = calActive && ACTIVE_DAYS.includes(d)
            return (
              <div key={d} style={{
                flex: 1, height: 32, borderRadius: 6,
                background: active ? C.greenGlow : C.surface2,
                border: `1px solid ${active ? C.greenBorder : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: MONO, fontSize: 10,
                color: active ? C.green : C.text3,
                letterSpacing: '0.06em',
                transition: 'all 0.3s ease',
              }}>{d}</div>
            )
          })}
        </div>
        {[
          { letter: 'A', name: 'Upper A', desc: 'Bench · Row · Incline Press · Cable Row · Lateral Raise · Triceps' },
          { letter: 'L', name: 'Lower A', desc: 'Bulgarian Split Squat · Hip Thrust · Leg Curl · Leg Extension · Calves' },
          { letter: 'B', name: 'Upper B', desc: 'OHP · Pull-Up · Machine Row · Face Pull · Bicep Curl' },
        ].map(s => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.greenGlow, border: `1px solid ${C.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontSize: 18, fontWeight: 800, color: C.green, flexShrink: 0 }}>{s.letter}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{s.name}</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quote */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px', marginBottom: 4 }}>
        <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.7, fontStyle: 'italic', position: 'relative' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 48, color: C.text3, position: 'absolute', top: -8, left: -6, lineHeight: 1, pointerEvents: 'none' }}>&ldquo;</span>
          <span style={{ paddingLeft: 28, display: 'block' }}>The hard part isn&apos;t the program. It&apos;s showing up three times a week and doing what you said you&apos;d do.</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 16, height: 1, background: C.green, display: 'block' }} />
          LazyFit Adaptive Coach
        </div>
      </div>

    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────────

  const stepContent = [null, step1, step2, step3, step4, step5][step]

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 430, margin: '0 auto' }}>
      <style>{`
        @keyframes stepEnter {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      {/* Top bar */}
      <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100, background: `linear-gradient(to bottom, ${C.bg} 80%, transparent)` }}>
        <button
          onClick={goPrev}
          disabled={step === 1}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: C.surface2, border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: step === 1 ? 'default' : 'pointer',
            opacity: step === 1 ? 0.2 : 1,
            flexShrink: 0,
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ height: 2, background: C.border, borderRadius: 99, position: 'relative', overflow: 'visible' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: C.green, borderRadius: 99, transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)', position: 'relative' }}>
              <div style={{ position: 'absolute', right: -1, top: '50%', transform: 'translateY(-50%)', width: 6, height: 6, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
            </div>
          </div>
        </div>

        <span style={{ fontFamily: MONO, fontSize: 11, color: '#aaa', flexShrink: 0, letterSpacing: '0.05em' }}>
          {String(step).padStart(2, '0')} / 05
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px 20px 0', overflowY: 'auto', scrollbarWidth: 'none' }}>
        <div key={animKey} style={{ animation: 'stepEnter 0.35s cubic-bezier(0.4,0,0.2,1) both' }}>
          {stepContent}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ padding: '16px 20px 36px', background: `linear-gradient(to top, ${C.bg} 70%, transparent)`, position: 'sticky', bottom: 0 }}>
        {submitError && (
          <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)', borderRadius: 10, fontSize: 13, color: '#ff3b5c' }}>
            {submitError}
          </div>
        )}
        <button
          onClick={step === 5 ? handleSubmit : goNext}
          disabled={submitting}
          style={{
            width: '100%',
            height: step === 5 ? 60 : 56,
            background: submitting ? C.green2 : C.green,
            color: '#000',
            fontFamily: FONT,
            fontSize: step === 5 ? 16 : 15,
            fontWeight: 700,
            border: 'none',
            borderRadius: step === 5 ? 16 : 14,
            cursor: submitting ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            letterSpacing: '0.02em',
            opacity: submitting ? 0.8 : 1,
          }}
        >
          {submitting ? 'Saving...' : CTA_LABELS[step]}
          {step < 5 && !submitting && (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
