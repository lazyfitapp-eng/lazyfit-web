import { getLocalDateString, parseLocalDateString } from './dateUtils'

export type GoalKey = 'cut' | 'recomp' | 'bulk'
export type JobActivity = 'desk' | 'feet' | 'labor'
export type ActivityFloorValue = 'under_4k' | '4_6k' | '6_8k' | '8_10k' | '10k_plus'
export type LegacyDailySteps = 'lt5k' | '<5k' | '5-10k' | '10-15k' | 'gt15k' | '>15k'
export type DailySteps = ActivityFloorValue | LegacyDailySteps

type ActivityFloorMeta = {
  value: ActivityFloorValue
  label: string
  sub: string
  representativeSteps: number
}

export const DEFAULT_ACTIVITY_FLOOR: ActivityFloorValue = '6_8k'

export const ACTIVITY_FLOOR_OPTIONS: readonly ActivityFloorMeta[] = [
  { value: 'under_4k', label: 'Under 4k', sub: 'Quiet baseline movement', representativeSteps: 3000 },
  { value: '4_6k', label: '4\u20136k', sub: 'Light daily movement', representativeSteps: 5000 },
  { value: '6_8k', label: '6\u20138k', sub: 'Typical daily movement', representativeSteps: 7000 },
  { value: '8_10k', label: '8\u201310k', sub: 'Active daily movement', representativeSteps: 9000 },
  { value: '10k_plus', label: '10k+', sub: 'High daily movement', representativeSteps: 11000 },
]

const LEGACY_ACTIVITY_FLOOR_META: Record<LegacyDailySteps, Omit<ActivityFloorMeta, 'value'>> = {
  lt5k: { label: '<5k', sub: 'Legacy activity floor', representativeSteps: 4000 },
  '<5k': { label: '<5k', sub: 'Legacy activity floor', representativeSteps: 4000 },
  '5-10k': { label: '5-10k', sub: 'Legacy activity floor', representativeSteps: 7500 },
  '10-15k': { label: '10-15k', sub: 'Legacy activity floor', representativeSteps: 12500 },
  gt15k: { label: '>15k', sub: 'Legacy activity floor', representativeSteps: 16000 },
  '>15k': { label: '>15k', sub: 'Legacy activity floor', representativeSteps: 16000 },
}

const ACTIVITY_FLOOR_BY_VALUE = ACTIVITY_FLOOR_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option }),
  {} as Record<ActivityFloorValue, ActivityFloorMeta>,
)

const JOB_MULTIPLIERS: Record<JobActivity, number> = {
  desk: 1.2,
  feet: 1.35,
  labor: 1.5,
}

const STEP_ADJUSTMENTS: Record<DailySteps, number> = {
  under_4k: 0,
  '4_6k': 0.05,
  '6_8k': 0.1,
  '8_10k': 0.15,
  '10k_plus': 0.2,
  lt5k: 0,
  '<5k': 0,
  '5-10k': 0.1,
  '10-15k': 0.2,
  gt15k: 0.3,
  '>15k': 0.3,
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

export function isDailyStepsValue(value: string | null | undefined): value is DailySteps {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STEP_ADJUSTMENTS, value)
}

export function validDailySteps(value: string | null | undefined): DailySteps {
  return isDailyStepsValue(value) ? value : DEFAULT_ACTIVITY_FLOOR
}

export function getCanonicalActivityFloor(value: string | null | undefined): ActivityFloorValue {
  const normalized = validDailySteps(value)
  if (Object.prototype.hasOwnProperty.call(ACTIVITY_FLOOR_BY_VALUE, normalized)) return normalized as ActivityFloorValue
  if (normalized === 'lt5k' || normalized === '<5k') return 'under_4k'
  if (normalized === '5-10k') return '6_8k'
  return '10k_plus'
}

export function getActivityFloorLabel(value: string | null | undefined): string {
  const normalized = validDailySteps(value)
  if (Object.prototype.hasOwnProperty.call(ACTIVITY_FLOOR_BY_VALUE, normalized)) return ACTIVITY_FLOOR_BY_VALUE[normalized as ActivityFloorValue].label
  return LEGACY_ACTIVITY_FLOOR_META[normalized as LegacyDailySteps].label
}

export function getActivityFloorSub(value: string | null | undefined): string {
  const normalized = validDailySteps(value)
  if (Object.prototype.hasOwnProperty.call(ACTIVITY_FLOOR_BY_VALUE, normalized)) return ACTIVITY_FLOOR_BY_VALUE[normalized as ActivityFloorValue].sub
  return LEGACY_ACTIVITY_FLOOR_META[normalized as LegacyDailySteps].sub
}

export function getRepresentativeDailySteps(value: string | null | undefined): number {
  const normalized = validDailySteps(value)
  if (Object.prototype.hasOwnProperty.call(ACTIVITY_FLOOR_BY_VALUE, normalized)) return ACTIVITY_FLOOR_BY_VALUE[normalized as ActivityFloorValue].representativeSteps
  return LEGACY_ACTIVITY_FLOOR_META[normalized as LegacyDailySteps].representativeSteps
}

function parseDateParts(year: number, month: number, day: number): Date | null {
  const parsed = new Date(year, month - 1, day)
  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
    ? parsed
    : null
}

export function normalizeDateOfBirth(dob: string | null | undefined): string | null {
  if (!dob) return null

  const value = dob.trim()
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/)
  if (isoMatch) {
    const isoDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    return parseLocalDateString(isoDate) ? isoDate : null
  }

  const dayFirstMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dayFirstMatch) {
    const parsed = parseDateParts(
      Number(dayFirstMatch[3]),
      Number(dayFirstMatch[2]),
      Number(dayFirstMatch[1]),
    )
    return parsed ? getLocalDateString(parsed) : null
  }

  return null
}

export function calcAgeFromDob(dob: string | null | undefined): number | null {
  const normalizedDob = normalizeDateOfBirth(dob)
  const birth = normalizedDob ? parseLocalDateString(normalizedDob) : null
  if (!birth) return null
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
