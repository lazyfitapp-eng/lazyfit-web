import { SupabaseClient } from '@supabase/supabase-js'

const THREE_DAY_TEMPLATE = [
  {
    name: 'Upper A',
    exercises: [
      { exercise_name: 'Barbell Bench Press',    sets_target: 3, reps_min: 5,  reps_max: 8,  rest_seconds: 180, exercise_order: 1 },
      { exercise_name: 'Barbell Row',            sets_target: 3, reps_min: 5,  reps_max: 8,  rest_seconds: 180, exercise_order: 2 },
      { exercise_name: 'Incline Dumbbell Press', sets_target: 3, reps_min: 8,  reps_max: 12, rest_seconds: 150, exercise_order: 3 },
      { exercise_name: 'Cable Row',              sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 120, exercise_order: 4 },
      { exercise_name: 'Lateral Raise',          sets_target: 3, reps_min: 12, reps_max: 15, rest_seconds: 90,  exercise_order: 5 },
      { exercise_name: 'Tricep Pushdown',        sets_target: 3, reps_min: 10, reps_max: 15, rest_seconds: 90,  exercise_order: 6 },
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

export { THREE_DAY_TEMPLATE }

export async function createDefaultRoutines(supabase: SupabaseClient, userId: string): Promise<void> {
  for (const tpl of THREE_DAY_TEMPLATE) {
    const { data: routine, error: rErr } = await supabase
      .from('routines')
      .insert({ user_id: userId, name: tpl.name })
      .select('id')
      .single()

    if (rErr || !routine) throw new Error(`Failed to create routine "${tpl.name}": ${rErr?.message}`)

    const { error: eErr } = await supabase
      .from('routine_exercises')
      .insert(tpl.exercises.map(ex => ({ ...ex, routine_id: routine.id })))

    if (eErr) throw new Error(`Failed to insert exercises for "${tpl.name}": ${eErr.message}`)
  }
}
