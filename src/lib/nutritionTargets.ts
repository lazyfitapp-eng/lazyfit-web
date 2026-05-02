export type GoalKey = 'cut' | 'recomp' | 'bulk'
export type JobActivity = 'desk' | 'feet' | 'labor'
export type DailySteps = 'lt5k' | '5-10k' | '10-15k' | 'gt15k'

const JOB_MULTIPLIERS: Record<JobActivity, number> = {
  desk: 1.2,
  feet: 1.35,
  labor: 1.5,
}

const STEP_ADJUSTMENTS: Record<DailySteps, number> = {
  lt5k: 0,
  '5-10k': 0.1,
  '10-15k': 0.2,
  gt15k: 0.3,
}

export function normalizeGoal(goal: string | null | undefined): GoalKey {
  if (goal === 'cut' || goal === 'recomp' || goal === 'bulk') return goal
  if (goal === 'lean_bulk') return 'bulk'
  return 'recomp'
}

export function validSex(value: string | null | undefined): 'male' | 'female' {
  return value?.toLowerCase() === 'female' ? 'female' : 'male'
}

export function validJobActivity(value: string | null | undefined): JobActivity {
  return value === 'feet' || value === 'labor' || value === 'desk' ? value : 'desk'
}

export function validDailySteps(value: string | null | undefined): DailySteps {
  return value === 'lt5k' || value === '5-10k' || value === '10-15k' || value === 'gt15k' ? value : '5-10k'
}

export function calcAgeFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null
  const birth = new Date(`${dob}T12:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDelta = today.getMonth() - birth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function calcNutritionTargets(
  goal: GoalKey,
  weightKg: number,
  heightCm: number,
  age: number,
  sex: string,
  jobActivity: JobActivity,
  dailySteps: DailySteps,
) {
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex.toLowerCase() === 'male' ? 5 : -161)
  const tdee = bmr * (JOB_MULTIPLIERS[jobActivity] + STEP_ADJUSTMENTS[dailySteps])
  const adjusted = goal === 'cut' ? tdee - 400 : goal === 'bulk' ? tdee + 250 : tdee
  const protein = Math.round(weightKg * (goal === 'cut' ? 1.8 : 1.6))
  const fat = Math.round((adjusted * 0.25) / 9)
  const carbs = Math.max(0, Math.round((adjusted - protein * 4 - fat * 9) / 4))
  return { kcal: Math.max(1200, Math.round(adjusted)), protein, fat, carbs, tdee: Math.round(tdee) }
}

export interface NutritionProfile {
  goal?: string | null
  current_weight?: number | null
  height_cm?: number | null
  age?: number | null
  date_of_birth?: string | null
  sex?: string | null
  job_activity?: string | null
  daily_steps?: string | null
  target_calories?: number | null
  target_protein?: number | null
  target_carbs?: number | null
  target_fat?: number | null
}

export function getComputedNutritionTargets(profile: NutritionProfile | null | undefined) {
  const goal = normalizeGoal(profile?.goal)
  const weightKg = profile?.current_weight || 80
  const age = calcAgeFromDob(profile?.date_of_birth) ?? profile?.age ?? 0
  const heightCm = profile?.height_cm ?? 0
  const sex = validSex(profile?.sex)
  const jobActivity = validJobActivity(profile?.job_activity)
  const dailySteps = validDailySteps(profile?.daily_steps)

  return weightKg > 0 && heightCm > 0 && age > 0
    ? calcNutritionTargets(goal, weightKg, heightCm, age, sex, jobActivity, dailySteps)
    : null
}

export function resolveNutritionTargets(
  profile: NutritionProfile | null | undefined,
  fallback = { calories: 0, protein: 0, carbs: 0, fat: 0 },
) {
  const computed = getComputedNutritionTargets(profile)
  return {
    calories: computed?.kcal ?? profile?.target_calories ?? fallback.calories,
    protein: computed?.protein ?? profile?.target_protein ?? fallback.protein,
    carbs: computed?.carbs ?? profile?.target_carbs ?? fallback.carbs,
    fat: computed?.fat ?? profile?.target_fat ?? fallback.fat,
  }
}
