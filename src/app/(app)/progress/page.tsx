import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProgressClient from './ProgressClient'
import { getCoachingCard, type CoachingInput, type CoachingCard } from '@/lib/coachingRules'
import { resolveNutritionTargets } from '@/lib/nutritionTargets'
import { getLocalDateString, getLocalDayBounds, getLocalWeekStartString, parseLocalDateString } from '@/lib/dateUtils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function epley(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

// ── Types exposed to the client ───────────────────────────────────────────────

export interface ExerciseSummary {
  name: string
  sessionCount: number
  current1RM: number
  first1RM: number
  delta: number
  /** Rising / Holding / Attention / Baseline */
  trend: 'rising' | 'holding' | 'attention' | 'baseline'
  recentSessions: { date: string; est1RM: number }[]
}

export interface PREntry {
  exerciseName: string
  est1RM: number
  weight: number
  reps: number
  date: string
  deltaFromStart: number
  sessionCount: number
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProgressPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── 1. Parallel fetches ───────────────────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = getLocalDateString(today)

  // Start of current week (Monday)
  const wkStartStr = getLocalWeekStartString(today)
  const wkStartBounds = getLocalDayBounds(wkStartStr)
  // Start of last year for weight/waist history
  const oneYearAgo = new Date(today)
  oneYearAgo.setFullYear(today.getFullYear() - 1)
  const oneYearAgoStr = getLocalDateString(oneYearAgo)

  const [
    { data: profile },
    { data: workouts },
    { data: weightEntries },
    { data: foodLogsWeek },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('goal, current_weight, height_cm, age, date_of_birth, sex, job_activity, daily_steps, target_calories, target_protein, target_carbs, target_fat, email')
      .eq('id', user.id)
      .single(),
    supabase
      .from('workouts')
      .select('id, completed_at')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: true }),
    supabase
      .from('weight_entries')
      .select('date, weight, trend_weight')
      .eq('user_id', user.id)
      .gte('date', oneYearAgoStr)
      .order('date', { ascending: true }),
    supabase
      .from('food_logs')
      .select('logged_at, calories, protein')
      .eq('user_id', user.id)
      .gte('logged_at', wkStartBounds.start)
      .order('logged_at', { ascending: true }),
  ])

  // ── 2. Workout sets (only if workouts exist) ──────────────────────────────
  const workoutList = workouts ?? []
  const workoutIds = workoutList.map((w) => w.id)

  let sets: {
    workout_id: string
    exercise_name: string
    weight_kg: number
    reps_completed: number
    set_type: string | null
  }[] = []

  if (workoutIds.length > 0) {
    const { data: setsData } = await supabase
      .from('workout_sets')
      .select('workout_id, exercise_name, weight_kg, reps_completed, set_type')
      .in('workout_id', workoutIds)
    sets = setsData ?? []
  }

  // ── 3. Body measurements (try/catch — table may not exist yet) ────────────
  let waistHistory: { date: string; waist_cm: number }[] = []
  try {
    const { data: measurements } = await supabase
      .from('body_measurements')
      .select('date, value_cm')
      .eq('user_id', user.id)
      .eq('category', 'waist')
      .not('value_cm', 'is', null)
      .gte('date', oneYearAgoStr)
      .order('date', { ascending: true })
    if (measurements) {
      waistHistory = measurements
        .filter((m) => m.value_cm != null)
        .map((m) => ({ date: m.date as string, waist_cm: m.value_cm as number }))
    }
  } catch {
    // table not yet created — silent fallback
  }

  // ── 4. Compute training dates ─────────────────────────────────────────────
  const completedAtById: Record<string, string> = {}
  for (const w of workoutList) {
    completedAtById[w.id] = getLocalDateString(new Date(w.completed_at as string))
  }
  const trainingDates = [...new Set(Object.values(completedAtById))].sort()
  const totalSessions = workoutList.length

  // ── 5. Weeks active since first workout ───────────────────────────────────
  let weeksActive = 0
  if (trainingDates.length > 0) {
    const firstDate = parseLocalDateString(trainingDates[0])
    if (firstDate) {
      const diffMs = today.getTime() - firstDate.getTime()
      weeksActive = Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)))
    }
  }

  // ── 6. Current streak (consecutive weeks with ≥1 session) ────────────────
  const tSet = new Set(trainingDates)
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - dow)
  thisMonday.setHours(0, 0, 0, 0)

  let currentStreakWeeks = 0
  for (let w = 0; w < 52; w++) {
    const wStart = new Date(thisMonday)
    wStart.setDate(thisMonday.getDate() - w * 7)
    let hasSession = false
    for (let d = 0; d < 7; d++) {
      const day = new Date(wStart)
      day.setDate(wStart.getDate() + d)
      if (day > today) continue
      if (tSet.has(getLocalDateString(day))) {
        hasSession = true
        break
      }
    }
    if (hasSession) currentStreakWeeks++
    else break
  }

  // bestStreakWeeks — full computation over all weeks
  let bestStreakWeeks = currentStreakWeeks
  if (trainingDates.length > 0) {
    const firstDate = parseLocalDateString(trainingDates[0])
    const totalWeeks = firstDate
      ? Math.ceil((today.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 0
    let running = 0
    for (let w = totalWeeks - 1; w >= 0; w--) {
      const wStart = new Date(thisMonday)
      wStart.setDate(thisMonday.getDate() - w * 7)
      let hasSession = false
      for (let d = 0; d < 7; d++) {
        const day = new Date(wStart)
        day.setDate(wStart.getDate() + d)
        if (day > today) continue
        if (tSet.has(getLocalDateString(day))) {
          hasSession = true
          break
        }
      }
      if (hasSession) {
        running++
        if (running > bestStreakWeeks) bestStreakWeeks = running
      } else {
        running = 0
      }
    }
  }

  // ── 7. Exercise 1RM data ──────────────────────────────────────────────────
  // Group sets by exercise → by workout → compute best 1RM per session
  const exerciseMap: Record<
    string,
    { date: string; workoutId: string; best1RM: number; bestWeight: number; bestReps: number }[]
  > = {}

  for (const s of sets) {
    if (s.set_type === 'warmup') continue
    const rm = epley(s.weight_kg ?? 0, s.reps_completed ?? 0)
    if (rm <= 0) continue
    const date = completedAtById[s.workout_id]
    if (!date) continue
    const name = (s.exercise_name as string).trim()
    if (!exerciseMap[name]) exerciseMap[name] = []
    const existing = exerciseMap[name].find((e) => e.workoutId === s.workout_id)
    if (existing) {
      if (rm > existing.best1RM) {
        existing.best1RM = rm
        existing.bestWeight = s.weight_kg
        existing.bestReps = s.reps_completed
      }
    } else {
      exerciseMap[name].push({
        date,
        workoutId: s.workout_id,
        best1RM: rm,
        bestWeight: s.weight_kg,
        bestReps: s.reps_completed,
      })
    }
  }

  // Sort each exercise's sessions by date ascending
  for (const name of Object.keys(exerciseMap)) {
    exerciseMap[name].sort((a, b) => (a.date < b.date ? -1 : 1))
  }

  // ── 8. Top exercises (sorted by session count, top 4) ────────────────────
  const MIN_SESSIONS_FOR_TREND = 4

  const topExercises: ExerciseSummary[] = Object.entries(exerciseMap)
    .filter(([, sessions]) => sessions.length >= 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4)
    .map(([name, sessions]) => {
      const first1RM = sessions[0].best1RM
      const current1RM = sessions[sessions.length - 1].best1RM
      const delta = current1RM - first1RM
      const sessionCount = sessions.length

      let trend: ExerciseSummary['trend'] = 'baseline'
      if (sessionCount >= MIN_SESSIONS_FOR_TREND) {
        // Look at last 3 sessions
        const recent = sessions.slice(-3)
        const diffs = recent
          .slice(1)
          .map((s, i) => s.best1RM - recent[i].best1RM)
        const allDown = diffs.every((d) => d < -0.5)
        const anyUp = diffs.some((d) => d > 0.5)
        const flat = diffs.every((d) => Math.abs(d) < 0.5)
        if (allDown) trend = 'attention'
        else if (anyUp) trend = 'rising'
        else if (flat) trend = 'holding'
        else trend = 'rising'
      }

      return {
        name,
        sessionCount,
        current1RM: Math.round(current1RM * 10) / 10,
        first1RM: Math.round(first1RM * 10) / 10,
        delta: Math.round(delta * 10) / 10,
        trend,
        recentSessions: sessions.slice(-8).map((s) => ({
          date: s.date,
          est1RM: Math.round(s.best1RM * 10) / 10,
        })),
      }
    })

  // ── 9. All-time PRs per exercise (latest PR only per exercise) ───────────
  const allTimePRs: PREntry[] = Object.entries(exerciseMap)
    .map(([name, sessions]) => {
      const sorted = [...sessions].sort((a, b) => b.best1RM - a.best1RM)
      const pr = sorted[0]
      const first = sessions[0]
      return {
        exerciseName: name,
        est1RM: Math.round(pr.best1RM * 10) / 10,
        weight: pr.bestWeight,
        reps: pr.bestReps,
        date: pr.date,
        deltaFromStart: Math.round((pr.best1RM - first.best1RM) * 10) / 10,
        sessionCount: sessions.length,
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first

  // ── 10. Recent PRs (last 30 days) ─────────────────────────────────────────
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  const thirtyDaysAgoStr = getLocalDateString(thirtyDaysAgo)
  const recentPRCount = allTimePRs.filter((pr) => pr.date >= thirtyDaysAgoStr).length

  // ── 11. Stalled exercise (3+ consecutive declining sessions) ─────────────
  let stalledExercise: string | null = null
  for (const [name, sessions] of Object.entries(exerciseMap)) {
    if (sessions.length < 4) continue
    const last4 = sessions.slice(-4)
    const diffs = last4.slice(1).map((s, i) => s.best1RM - last4[i].best1RM)
    if (diffs.every((d) => d < -0.5)) {
      stalledExercise = name
      break
    }
  }

  // ── 12. Days since last workout ───────────────────────────────────────────
  let daysSinceLastWorkout = 0
  if (trainingDates.length > 0) {
    const lastDate = parseLocalDateString(trainingDates[trainingDates.length - 1])
    daysSinceLastWorkout = Math.floor(
      lastDate ? (today.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000) : 0
    )
  }

  // ── 13. Nutrition this week ───────────────────────────────────────────────
  const weekFoodLogs = (foodLogsWeek ?? []).map((l) => ({
    date: getLocalDateString(new Date(l.logged_at as string)),
    calories: l.calories ?? 0,
    protein: l.protein ?? 0,
  }))

  // ── 14. Weight history ────────────────────────────────────────────────────
  const weightHistory = (weightEntries ?? []).map((e) => ({
    date: e.date as string,
    weight: e.weight as number,
    trendWeight: (e.trend_weight as number | null) ?? null,
  }))

  // ── 15. Derive user name (first name only) ───────────────────────────────
  // Name: derive first name from email username (last word = first name in last-first email conventions)
  const rawName: string = profile?.email ?? user.email ?? ''
  const emailUser = rawName.includes('@') ? rawName.split('@')[0] : rawName
  const nameParts = emailUser.replace(/[._-]/g, ' ').trim().split(' ').filter(Boolean)
  // Take the last part — handles both "first.last" and "last.first" conventions
  const firstName = nameParts[nameParts.length - 1] ?? ''
  const userName = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : 'You'

  // ── 16. Coaching card ─────────────────────────────────────────────────────
  const nutritionTargets = resolveNutritionTargets(profile, { calories: 2000, protein: 150, carbs: 200, fat: 70 })
  const targetCal = nutritionTargets.calories
  const targetProt = nutritionTargets.protein

  const weekCalAvg =
    weekFoodLogs.length > 0
      ? weekFoodLogs.reduce((s, l) => s + l.calories, 0) / weekFoodLogs.length
      : 0
  const weekProtAvg =
    weekFoodLogs.length > 0
      ? weekFoodLogs.reduce((s, l) => s + l.protein, 0) / weekFoodLogs.length
      : 0

  const coachingInput: CoachingInput = {
    userName,
    goal: (profile?.goal ?? 'recomp') as 'cut' | 'bulk' | 'recomp',
    totalSessions,
    weeksActive,
    currentStreakWeeks,
    bestStreakWeeks,
    recentPRCount,
    stalledExercise,
    weeklyAvgCalPct: targetCal > 0 ? weekCalAvg / targetCal : 0,
    weeklyAvgProtPct: targetProt > 0 ? weekProtAvg / targetProt : 0,
    daysSinceLastWorkout,
  }

  const coachingCard: CoachingCard = getCoachingCard(coachingInput)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ProgressClient
      userName={userName}
      goal={(profile?.goal ?? 'recomp') as 'cut' | 'bulk' | 'recomp'}
      targetCalories={targetCal}
      targetProtein={targetProt}
      userCreatedAt={user.created_at ?? new Date().toISOString()}
      trainingDates={trainingDates}
      totalSessions={totalSessions}
      weeksActive={weeksActive}
      currentStreakWeeks={currentStreakWeeks}
      bestStreakWeeks={bestStreakWeeks}
      topExercises={topExercises}
      allTimePRs={allTimePRs}
      weightHistory={weightHistory}
      waistHistory={waistHistory}
      weekFoodLogs={weekFoodLogs}
      coachingCard={coachingCard}
    />
  )
}
