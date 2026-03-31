import { WeightEntry } from '@/types';

/**
 * Calculate trend weight using moving average
 * This smooths out daily fluctuations to show true weight direction
 * Algorithm inspired by MacroFactor
 */
export function calculateTrendWeight(
  currentWeight: number,
  previousEntries: WeightEntry[],
  windowSize: number = 7
): number {
  // Get recent entries within the window
  const recentEntries = previousEntries
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, windowSize - 1);
  
  // Add current weight
  const allWeights = [currentWeight, ...recentEntries.map(e => e.weight)];
  
  // Calculate exponential moving average (more weight on recent entries)
  const alpha = 2 / (windowSize + 1);
  let trend = allWeights[allWeights.length - 1] || currentWeight;
  
  for (let i = allWeights.length - 2; i >= 0; i--) {
    trend = alpha * allWeights[i] + (1 - alpha) * trend;
  }
  
  return Math.round(trend * 10) / 10;
}

/**
 * Calculate weekly weight change
 */
export function calculateWeeklyChange(entries: WeightEntry[]): number {
  if (entries.length < 7) return 0;
  
  const sorted = entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const thisWeek = sorted.slice(-7);
  const lastWeek = sorted.slice(-14, -7);
  
  if (lastWeek.length === 0) return 0;
  
  const thisWeekAvg = thisWeek.reduce((sum, e) => sum + e.weight, 0) / thisWeek.length;
  const lastWeekAvg = lastWeek.reduce((sum, e) => sum + e.weight, 0) / lastWeek.length;
  
  return Math.round((thisWeekAvg - lastWeekAvg) * 10) / 10;
}

/**
 * Calculate TDEE (Total Daily Energy Expenditure) based on weight trend
 * This is the core algorithm that makes LazyFit "smart"
 * 
 * If you're losing 0.5kg/week = 3850 calorie deficit/week = 550/day
 * So your TDEE = calories eaten + 550
 */
export function calculateTDEE(
  caloriesConsumed: number,
  weeklyWeightChange: number // in kg, positive = gain, negative = loss
): number {
  // 1kg of fat = ~7700 calories
  const calorieDeltaPerDay = (weeklyWeightChange * 7700) / 7;
  
  // TDEE = calories eaten - calorie deficit (or + surplus)
  const tdee = caloriesConsumed + calorieDeltaPerDay;
  
  return Math.round(tdee);
}

/**
 * Suggest calorie target based on goal
 */
export function suggestCalorieTarget(
  currentTDEE: number,
  goal: 'lose' | 'maintain' | 'gain',
  weeklyWeightChange: number
): number {
  switch (goal) {
    case 'lose':
      // Aim for 0.5-1% body weight loss per week
      // 0.5kg/week = 3850 calorie deficit = 550/day
      return Math.round(currentTDEE - 500);
    case 'gain':
      // Aim for 0.25-0.5% body weight gain per week
      return Math.round(currentTDEE + 300);
    case 'maintain':
    default:
      // Stay at TDEE
      return Math.round(currentTDEE);
  }
}

/**
 * Get weight trend direction and message
 */
export function getTrendMessage(weeklyChange: number): {
  direction: 'up' | 'down' | 'stable';
  message: string;
  color: string;
} {
  if (weeklyChange > 0.2) {
    return {
      direction: 'up',
      message: `↑ +${weeklyChange}kg this week`,
      color: '#FF0040',
    };
  } else if (weeklyChange < -0.2) {
    return {
      direction: 'down',
      message: `↓ ${weeklyChange}kg this week`,
      color: '#00FF41',
    };
  } else {
    return {
      direction: 'stable',
      message: `→ Stable (${weeklyChange}kg)`,
      color: '#888888',
    };
  }
}

/**
 * Get a reality check message based on recent behavior
 */
export function getRealityCheck(
  caloriesConsumed: number,
  calorieTarget: number,
  weeklyChange: number
): string | null {
  // Overate significantly
  if (caloriesConsumed > calorieTarget + 500) {
    const excess = caloriesConsumed - calorieTarget;
    return `You ate ${excess} calories over target. That's ${Math.round(excess / 50)} minutes of running to burn off.`;
  }
  
  // Expected weight gain but trending down
  if (caloriesConsumed > calorieTarget && weeklyChange < -0.1) {
    return 'Your body is still catching up. Water weight can mask fat loss.';
  }
  
  // Expected weight loss but trending up
  if (caloriesConsumed < calorieTarget && weeklyChange > 0.1) {
    return 'The scale shows gain, but look at the trend. One data point ≠ truth.';
  }
  
  return null;
}