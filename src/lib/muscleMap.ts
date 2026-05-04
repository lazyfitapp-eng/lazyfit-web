export const MUSCLE_MAP: { keyword: string; muscle: string; color: string }[] = [
  { keyword: 'incline barbell press', muscle: 'Chest', color: '#4a9eff' },
  { keyword: 'incline dumbbell press', muscle: 'Chest', color: '#4a9eff' },
  { keyword: 'flat dumbbell press', muscle: 'Chest', color: '#4a9eff' },
  { keyword: 'bench', muscle: 'Chest', color: '#4a9eff' },
  { keyword: 'chest', muscle: 'Chest', color: '#4a9eff' },
  { keyword: 'fly', muscle: 'Chest', color: '#4a9eff' },
  { keyword: 'push-up', muscle: 'Chest', color: '#4a9eff' },
  { keyword: 'squat', muscle: 'Quads', color: '#00FF41' },
  { keyword: 'leg press', muscle: 'Quads', color: '#00FF41' },
  { keyword: 'leg extension', muscle: 'Quads', color: '#00FF41' },
  { keyword: 'deadlift', muscle: 'Back', color: '#ff6b4a' },
  { keyword: 'row', muscle: 'Back', color: '#ff6b4a' },
  { keyword: 'pull-up', muscle: 'Back', color: '#ff6b4a' },
  { keyword: 'pull up', muscle: 'Back', color: '#ff6b4a' },
  { keyword: 'pulldown', muscle: 'Back', color: '#ff6b4a' },
  { keyword: 'pullover', muscle: 'Back', color: '#ff6b4a' },
  { keyword: 'chin', muscle: 'Back', color: '#ff6b4a' },
  { keyword: 'lat ', muscle: 'Back', color: '#ff6b4a' },
  { keyword: 'overhead press', muscle: 'Shoulders', color: '#FFAA00' },
  { keyword: 'shoulder press', muscle: 'Shoulders', color: '#FFAA00' },
  { keyword: 'lateral', muscle: 'Shoulders', color: '#FFAA00' },
  { keyword: 'face pull', muscle: 'Shoulders', color: '#FFAA00' },
  { keyword: 'rear delt', muscle: 'Shoulders', color: '#FFAA00' },
  { keyword: 'front raise', muscle: 'Shoulders', color: '#FFAA00' },
  { keyword: 'curl', muscle: 'Arms', color: '#cc44ff' },
  { keyword: 'tricep', muscle: 'Arms', color: '#cc44ff' },
  { keyword: 'pushdown', muscle: 'Arms', color: '#cc44ff' },
  { keyword: 'skull', muscle: 'Arms', color: '#cc44ff' },
  { keyword: 'dip', muscle: 'Arms', color: '#cc44ff' },
  { keyword: 'romanian', muscle: 'Hamstrings', color: '#00CC33' },
  { keyword: 'rdl', muscle: 'Hamstrings', color: '#00CC33' },
  { keyword: 'leg curl', muscle: 'Hamstrings', color: '#00CC33' },
  { keyword: 'hamstring', muscle: 'Hamstrings', color: '#00CC33' },
  { keyword: 'calf', muscle: 'Calves', color: '#888' },
  { keyword: 'glute', muscle: 'Glutes', color: '#ff4a9e' },
  { keyword: 'hip thrust', muscle: 'Glutes', color: '#ff4a9e' },
  { keyword: 'crunch', muscle: 'Core', color: '#aaa' },
  { keyword: 'plank', muscle: 'Core', color: '#aaa' },
]

export function getMuscle(name: string): { muscle: string; color: string } {
  const lower = name.toLowerCase()
  for (const m of MUSCLE_MAP) {
    if (lower.includes(m.keyword)) return { muscle: m.muscle, color: m.color }
  }
  return { muscle: 'Other', color: '#b8b8b8' }
}

export function computeMuscleSplit(
  sets: { exercise_name: string; weight_kg: number; reps_completed: number }[]
): { muscle: string; pct: number; color: string }[] {
  const vol: Record<string, { volume: number; color: string }> = {}
  let total = 0
  for (const s of sets) {
    const { muscle, color } = getMuscle(s.exercise_name)
    const v = s.weight_kg * s.reps_completed
    if (!vol[muscle]) vol[muscle] = { volume: 0, color }
    vol[muscle].volume += v
    total += v
  }
  return Object.entries(vol)
    .map(([muscle, { volume, color }]) => ({
      muscle,
      color,
      pct: total > 0 ? Math.round((volume / total) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)
}
