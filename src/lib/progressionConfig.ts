// ── Progression configuration ─────────────────────────────────────────────────
// Single source of truth for exercise type classification, weight increments,
// deload percentage, bodyweight semantics, and primary coach-card exercises.

export type ExerciseType = 'barbell_compound' | 'dumbbell_compound' | 'cable_machine' | 'isolation' | 'bodyweight'

export const DELOAD_FACTOR = 0.85
export const DELOAD_PERCENT_LABEL = `${Math.round(DELOAD_FACTOR * 100)}%`

export const BODYWEIGHT_EXERCISES = ['Pull-Up']

export function isBodyweightExercise(exerciseName: string): boolean {
  return BODYWEIGHT_EXERCISES.includes(exerciseName)
}

export const EXERCISE_TYPE: Record<string, ExerciseType> = {
  'Barbell Bench Press':    'barbell_compound',
  'Barbell Row':            'barbell_compound',
  'Overhead Press':         'barbell_compound',
  'Pull-Up':                'bodyweight',
  'Bulgarian Split Squat':  'barbell_compound',
  'Incline Dumbbell Press': 'dumbbell_compound',
  'Cable Row':              'cable_machine',
  'Machine Row':            'cable_machine',
  'Leg Press':              'cable_machine',
  'Leg Extension':          'cable_machine',
  'Lying Leg Curl':         'cable_machine',
  'Seated Leg Curl':        'cable_machine',
  'Hip Thrust':             'cable_machine',
  'Lateral Raise':          'isolation',
  'Cable Lateral Raise':    'isolation',
  'Tricep Pushdown':        'isolation',
  'Bicep Curl':             'isolation',
  'Face Pull':              'isolation',
  'Calf Raise':             'isolation',
  'Incline Barbell Press':  'barbell_compound',
  'Flat Dumbbell Press':    'dumbbell_compound',
  'Lat Pulldown':           'cable_machine',
  'Barbell Squat':          'barbell_compound',
  'Romanian Deadlift':      'barbell_compound',
  'Leg Curl':               'cable_machine',
}

export const WEIGHT_INCREMENT: Record<ExerciseType, number> = {
  barbell_compound: 2.5,
  dumbbell_compound: 2.5,
  cable_machine:    5.0,
  isolation:        1.0,
  bodyweight:       2.5,
}

// Exercises that receive the active-workout coach card.
// Warm-up callers should skip bodyweight exercises unless a specific rule exists.
// Exact name match — must match exercise_name values stored in the DB.
export const PRIMARY_COMPOUNDS: string[] = [
  'Barbell Bench Press',
  'Overhead Press',
  'Pull-Up',
  'Bulgarian Split Squat',
  'Barbell Row',
  'Incline Barbell Press',
]
