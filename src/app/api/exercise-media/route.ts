import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')  // strip parentheses
    .replace(/\s+/g, ' ')
    .trim()
}

// Maps our exercise names → ExerciseDB search terms when the exact name doesn't match
const EXERCISE_ALIASES: Record<string, string> = {
  'barbell row':            'barbell bent over row',
  'barbell squat':          'barbell full squat',
  'romanian deadlift':      'barbell romanian deadlift',
  'cable row':              'cable seated row',
  'tricep pushdown':        'cable pushdown',
  'skull crusher':          'barbell skull crusher',
  'calf raise':             'standing calf raises',
  'bulgarian split squat':  'barbell split squat',
  'pendulum squat':         'hack squat',
  'lying leg curl':         'leg curl',
  'seated leg curl':        'lever seated leg curl',
  'hip thrust':             'barbell hip thrust',
  'overhead press':         'barbell overhead press',
  'bicep curl':             'barbell curl',
  'pull-up':                'pull up',
  'incline barbell press':  'barbell incline bench press',
  'flat dumbbell press':    'dumbbell bench press',
  'lat pulldown':           'cable pulldown',
  'leg press':              'sled 45 leg press',
  'cable lateral raise':    'cable lateral raise',
  'dumbbell shoulder press':'dumbbell shoulder press',
  'face pull':              'cable face pull',
}

async function fetchFromExerciseDB(searchName: string, apiKey: string): Promise<{ data: any | null; error: string | null }> {
  try {
    const res = await fetch(
      `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(searchName)}?limit=1&offset=0`,
      {
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
        },
      }
    )
    if (!res.ok) {
      const text = await res.text()
      return { data: null, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }
    const json = await res.json()
    const found = Array.isArray(json) && json.length > 0 ? json[0] : null
    return { data: found, error: found ? null : `No results for "${searchName}"` }
  } catch (e: any) {
    return { data: null, error: `Fetch failed: ${e.message}` }
  }
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Only use cache if gif_url is present — null cache entries are re-fetched
  const { data: cached } = await supabase
    .from('exercise_media')
    .select('gif_url, instructions, target_muscle, secondary_muscles')
    .eq('exercise_name', name)
    .not('gif_url', 'is', null)
    .single()

  if (cached) {
    return NextResponse.json({
      gifUrl: cached.gif_url,
      instructions: cached.instructions ?? [],
      targetMuscle: cached.target_muscle,
      secondaryMuscles: cached.secondary_muscles ?? [],
    })
  }

  // Fetch from ExerciseDB via RapidAPI
  if (!process.env.EXERCISEDB_API_KEY) {
    return NextResponse.json({ error: 'EXERCISEDB_API_KEY is not set in .env.local' }, { status: 500 })
  }

  const apiKey = process.env.EXERCISEDB_API_KEY
  const normalized = normalizeName(name)
  const alias = EXERCISE_ALIASES[normalized]

  // Try: exact normalized name → alias → first word fallback
  const namesToTry = [
    normalized,
    ...(alias ? [alias] : []),
    normalized.split(' ')[0],
  ].filter((v, i, a) => a.indexOf(v) === i) // deduplicate

  let exerciseData: any = null
  const errors: string[] = []
  for (const tryName of namesToTry) {
    const result = await fetchFromExerciseDB(tryName, apiKey)
    if (result.data) { exerciseData = result.data; break }
    if (result.error) errors.push(`[${tryName}]: ${result.error}`)
  }

  if (!exerciseData) {
    return NextResponse.json({
      gifUrl: null,
      instructions: [],
      targetMuscle: null,
      secondaryMuscles: [],
      _debug: errors,  // visible in browser Network tab
    })
  }

  const result = {
    gifUrl: exerciseData.gifUrl ?? null,
    instructions: Array.isArray(exerciseData.instructions) ? exerciseData.instructions : [],
    targetMuscle: exerciseData.target ?? null,
    secondaryMuscles: Array.isArray(exerciseData.secondaryMuscles) ? exerciseData.secondaryMuscles : [],
  }

  // Only cache when we have a real GIF URL — stale null entries are purged on next request
  if (result.gifUrl) {
    await supabase.from('exercise_media').upsert({
      exercise_name: name,
      gif_url: result.gifUrl,
      instructions: result.instructions,
      target_muscle: result.targetMuscle,
      secondary_muscles: result.secondaryMuscles,
    })
  }

  return NextResponse.json(result)
}
