// Mifflin-St Jeor equation for BMR, then TDEE with activity multiplier
export function estimateInitialTDEE(
  weight: number, // kg
  height: number, // cm
  age: number,
  sex: 'male' | 'female',
  activityMultiplier: number = 1.55
): number {
  let bmr: number;
  if (sex === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }
  return Math.round(bmr * activityMultiplier);
}

export const ACTIVITY_MULTIPLIERS = {
  sedentary:  1.20,
  light:      1.375,
  moderate:   1.55,
  active:     1.725,
  very_active: 1.90,
} as const;

export const STRESS_ADJUSTMENT = {
  low: 0,
  moderate: -50,
  high: -100,
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_MULTIPLIERS;
export type StressLevel = keyof typeof STRESS_ADJUSTMENT;

export function calculateInitialTargets(
  weight: number,
  height: number,
  age: number,
  sex: 'male' | 'female',
  goal: 'cut' | 'bulk' | 'recomp',
  activityLevel: ActivityLevel = 'moderate',
  stressLevel: StressLevel = 'low',
  bodyFatPct?: number | null
): { calories: number; protein: number; carbs: number; fat: number } {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  const baseTdee = estimateInitialTDEE(weight, height, age, sex, multiplier);
  const tdee = baseTdee + STRESS_ADJUSTMENT[stressLevel];

  let calories: number;
  if (goal === 'cut') {
    calories = tdee - 500;
  } else if (goal === 'bulk') {
    calories = tdee + 300;
  } else {
    calories = tdee;
  }
  // Ensure calories don't drop below a safe minimum
  calories = Math.max(calories, sex === 'male' ? 1200 : 1000);

  // Protein targets based on Morton et al. (2018) BJSM meta-analysis:
  // Evidence-based ceiling is ~1.62g/kg; 1.8g/kg (0.82g/lb) covers even the most active individuals.
  // When lean mass is known we use 2.0g/kg lean mass (Helms et al. range for active people),
  // but always ensure at least 1.8g/kg total body weight so we don't under-target overweight users.
  const MIN_PROTEIN_PER_KG = 1.8; // 0.82 g/lb converted to metric
  const leanMass = bodyFatPct ? weight * (1 - bodyFatPct / 100) : null;
  const rawProtein = leanMass ? leanMass * 2.0 : weight * MIN_PROTEIN_PER_KG;
  const protein = Math.round(Math.max(rawProtein, weight * MIN_PROTEIN_PER_KG));

  const fat = Math.round(weight * 0.8); // 0.8g/kg minimum
  const proteinCalories = protein * 4;
  const fatCalories = fat * 9;
  const carbCalories = calories - proteinCalories - fatCalories;
  const carbs = Math.max(Math.round(carbCalories / 4), 50); // minimum 50g carbs

  return { calories, protein, carbs, fat };
}
