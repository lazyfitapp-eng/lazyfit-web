import { SupabaseClient } from '@supabase/supabase-js'

export const LOWER_DAY_STYLES = ['back_friendly', 'barbell'] as const
export type LowerDayStyle = typeof LOWER_DAY_STYLES[number]
export type ProgramSlot = 'upper_a' | 'lower' | 'upper_b'

export const DEFAULT_LOWER_DAY_STYLE: LowerDayStyle = 'back_friendly'
export const PROGRAM_SLOT_ORDER: ProgramSlot[] = ['upper_a', 'lower', 'upper_b']

type RoutineExerciseTemplate = {
  exercise_name: string
  sets_target: number
  reps_min: number
  reps_max: number
  rest_seconds: number
  exercise_order: number
}

type RoutineTemplate = {
  name: string
  slot?: ProgramSlot
  exercises: RoutineExerciseTemplate[]
}

function isLowerDayStyle(value: unknown): value is LowerDayStyle {
  return value === 'back_friendly' || value === 'barbell'
}

export function resolveLowerDayStyle(value: unknown): LowerDayStyle {
  return isLowerDayStyle(value) ? value : DEFAULT_LOWER_DAY_STYLE
}

const UPPER_A_TEMPLATE: RoutineTemplate = {
  name: 'Upper A',
  slot: 'upper_a',
  exercises: [
    { exercise_name: 'Incline Barbell Press', sets_target: 3, reps_min: 5,  reps_max: 8,  rest_seconds: 180, exercise_order: 1 },
    { exercise_name: 'Lat Pulldown',          sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 120, exercise_order: 2 },
    { exercise_name: 'Flat Dumbbell Press',   sets_target: 3, reps_min: 8,  reps_max: 12, rest_seconds: 150, exercise_order: 3 },
    { exercise_name: 'Cable Row',             sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 120, exercise_order: 4 },
    { exercise_name: 'Lateral Raise',         sets_target: 3, reps_min: 12, reps_max: 15, rest_seconds: 90,  exercise_order: 5 },
    { exercise_name: 'Tricep Pushdown',       sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 90,  exercise_order: 6 },
  ],
}

const LOWER_A_TEMPLATE: RoutineTemplate = {
  name: 'Lower A',
  slot: 'lower',
  exercises: [
    { exercise_name: 'Bulgarian Split Squat', sets_target: 3, reps_min: 8,  reps_max: 12, rest_seconds: 180, exercise_order: 1 },
    { exercise_name: 'Hip Thrust',            sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 150, exercise_order: 2 },
    { exercise_name: 'Seated Leg Curl',       sets_target: 4, reps_min: 10, reps_max: 15, rest_seconds: 120, exercise_order: 3 },
    { exercise_name: 'Leg Extension',         sets_target: 3, reps_min: 12, reps_max: 15, rest_seconds: 120, exercise_order: 4 },
    { exercise_name: 'Calf Raise',            sets_target: 4, reps_min: 15, reps_max: 20, rest_seconds: 90,  exercise_order: 5 },
  ],
}

const LOWER_B_TEMPLATE: RoutineTemplate = {
  name: 'Lower B',
  slot: 'lower',
  exercises: [
    { exercise_name: 'Barbell Squat',     sets_target: 3, reps_min: 6,  reps_max: 10, rest_seconds: 180, exercise_order: 1 },
    { exercise_name: 'Romanian Deadlift', sets_target: 2, reps_min: 8,  reps_max: 12, rest_seconds: 180, exercise_order: 2 },
    { exercise_name: 'Leg Press',         sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 150, exercise_order: 3 },
    { exercise_name: 'Seated Leg Curl',   sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 120, exercise_order: 4 },
    { exercise_name: 'Calf Raise',        sets_target: 4, reps_min: 15, reps_max: 20, rest_seconds: 90,  exercise_order: 5 },
  ],
}

const UPPER_B_TEMPLATE: RoutineTemplate = {
  name: 'Upper B',
  slot: 'upper_b',
  exercises: [
    { exercise_name: 'Overhead Press',       sets_target: 3, reps_min: 5,  reps_max: 8,  rest_seconds: 180, exercise_order: 1 },
    { exercise_name: 'Pull-Up',              sets_target: 3, reps_min: 5,  reps_max: 8,  rest_seconds: 180, exercise_order: 2 },
    { exercise_name: 'Machine Row',          sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 150, exercise_order: 3 },
    { exercise_name: 'Cable Lateral Raise',  sets_target: 2, reps_min: 12, reps_max: 15, rest_seconds: 90,  exercise_order: 4 },
    { exercise_name: 'Face Pull',            sets_target: 3, reps_min: 15, reps_max: 20, rest_seconds: 90,  exercise_order: 5 },
    { exercise_name: 'Bicep Curl',           sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 90,  exercise_order: 6 },
  ],
}

export function getRoutineNameForProgramSlot(slot: ProgramSlot, lowerDayStyle: LowerDayStyle = DEFAULT_LOWER_DAY_STYLE): string {
  if (slot === 'upper_a') return UPPER_A_TEMPLATE.name
  if (slot === 'upper_b') return UPPER_B_TEMPLATE.name
  return resolveLowerDayStyle(lowerDayStyle) === 'barbell' ? LOWER_B_TEMPLATE.name : LOWER_A_TEMPLATE.name
}

export function getProgramSlotForRoutineName(name: string | null | undefined): ProgramSlot | null {
  if (name === UPPER_A_TEMPLATE.name) return 'upper_a'
  if (name === LOWER_A_TEMPLATE.name || name === LOWER_B_TEMPLATE.name) return 'lower'
  if (name === UPPER_B_TEMPLATE.name) return 'upper_b'
  return null
}

export function isProgramRoutineName(name: string | null | undefined): boolean {
  return getProgramSlotForRoutineName(name) !== null
}

export function getThreeDayTemplate(lowerDayStyle: LowerDayStyle = DEFAULT_LOWER_DAY_STYLE): RoutineTemplate[] {
  return [
    UPPER_A_TEMPLATE,
    resolveLowerDayStyle(lowerDayStyle) === 'barbell' ? LOWER_B_TEMPLATE : LOWER_A_TEMPLATE,
    UPPER_B_TEMPLATE,
  ]
}

export function getActiveProgramRoutineNames(lowerDayStyle: LowerDayStyle = DEFAULT_LOWER_DAY_STYLE): string[] {
  return PROGRAM_SLOT_ORDER.map(slot => getRoutineNameForProgramSlot(slot, lowerDayStyle))
}

export function getProgramDayNumber(name: string, lowerDayStyle: LowerDayStyle = DEFAULT_LOWER_DAY_STYLE): number | null {
  const activeRoutineNames = getActiveProgramRoutineNames(lowerDayStyle)
  const idx = activeRoutineNames.indexOf(name)
  return idx >= 0 ? idx + 1 : null
}

const THREE_DAY_TEMPLATE = getThreeDayTemplate(DEFAULT_LOWER_DAY_STYLE)

const ALL_CURRENT_PROGRAM_TEMPLATES = [
  UPPER_A_TEMPLATE,
  LOWER_A_TEMPLATE,
  LOWER_B_TEMPLATE,
  UPPER_B_TEMPLATE,
]

const LEGACY_THREE_DAY_TEMPLATE: RoutineTemplate[] = [
  {
    name: 'Upper A',
    exercises: [
      { exercise_name: 'Barbell Bench Press',    sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 1 },
      { exercise_name: 'Barbell Row',            sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 2 },
      { exercise_name: 'Incline Dumbbell Press', sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 3 },
      { exercise_name: 'Cable Row',              sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 4 },
      { exercise_name: 'Lateral Raise',          sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 5 },
      { exercise_name: 'Tricep Pushdown',        sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 6 },
    ],
  },
  {
    name: 'Upper B',
    exercises: [
      { exercise_name: 'Overhead Press', sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 1 },
      { exercise_name: 'Pull-Up',        sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 2 },
      { exercise_name: 'Machine Row',    sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 3 },
      { exercise_name: 'Face Pull',      sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 4 },
      { exercise_name: 'Bicep Curl',     sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 5 },
    ],
  },
  {
    name: 'Lower A',
    exercises: [
      { exercise_name: 'Bulgarian Split Squat', sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 1 },
      { exercise_name: 'Hip Thrust',            sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 2 },
      { exercise_name: 'Lying Leg Curl',        sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 3 },
      { exercise_name: 'Leg Extension',         sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 4 },
      { exercise_name: 'Calf Raise',            sets_target: 0, reps_min: 0, reps_max: 0, rest_seconds: 0, exercise_order: 5 },
    ],
  },
]

const DEFAULT_ROUTINE_DELETE_GUARD_TEMPLATES = [
  ...ALL_CURRENT_PROGRAM_TEMPLATES,
  ...LEGACY_THREE_DAY_TEMPLATE,
]

export { THREE_DAY_TEMPLATE, DEFAULT_ROUTINE_DELETE_GUARD_TEMPLATES }

export async function createDefaultRoutines(
  supabase: SupabaseClient,
  userId: string,
  lowerDayStyle: LowerDayStyle = DEFAULT_LOWER_DAY_STYLE
): Promise<void> {
  const selectedTemplate = getThreeDayTemplate(lowerDayStyle)
  const templateNames = selectedTemplate.map(tpl => tpl.name)
  const { data: existingRoutines, error: existingErr } = await supabase
    .from('routines')
    .select('id, name, is_system')
    .eq('user_id', userId)
    .in('name', templateNames)

  if (existingErr) throw new Error(`Failed to check default routines: ${existingErr.message}`)

  const systemRoutineByName = new Map(
    (existingRoutines ?? [])
      .filter(r => r.is_system === true)
      .map(r => [r.name, r.id])
  )

  for (const tpl of selectedTemplate) {
    let routineId = systemRoutineByName.get(tpl.name)
    let shouldInsertExercises = false

    if (!routineId) {
      const { data: routine, error: rErr } = await supabase
        .from('routines')
        .insert({ user_id: userId, name: tpl.name, is_system: true })
        .select('id')
        .single()

      if (rErr || !routine) throw new Error(`Failed to create routine "${tpl.name}": ${rErr?.message}`)

      routineId = routine.id
      shouldInsertExercises = true
    } else {
      const { data: existingExercises, error: exCheckErr } = await supabase
        .from('routine_exercises')
        .select('exercise_name')
        .eq('routine_id', routineId)

      if (exCheckErr) throw new Error(`Failed to check exercises for "${tpl.name}": ${exCheckErr.message}`)

      const existingExerciseNames = (existingExercises ?? []).map(ex => ex.exercise_name)
      const exerciseSet = new Set(existingExerciseNames)
      const alreadyCurrent =
        existingExerciseNames.length === tpl.exercises.length &&
        tpl.exercises.every(ex => exerciseSet.has(ex.exercise_name))

      if (alreadyCurrent) continue
      if (existingExerciseNames.length === 0) shouldInsertExercises = true
    }

    if (!shouldInsertExercises) continue

    const { error: eErr } = await supabase
      .from('routine_exercises')
      .insert(tpl.exercises.map(ex => ({ ...ex, routine_id: routineId })))

    if (eErr) throw new Error(`Failed to insert exercises for "${tpl.name}": ${eErr.message}`)
  }
}
