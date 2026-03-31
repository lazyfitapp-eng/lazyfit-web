export interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
  servingUnit: string;
  isCustom?: boolean;
  brand?: string;
  /** Optional English/alias keywords for bilingual search */
  searchTerms?: string[];
}

export interface LoggedFood {
  id: string;
  foodId: string;
  food: Food;
  quantity: number;
  loggedAt: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface DailyLog {
  date: string;
  foods: LoggedFood[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface WeightEntry {
  id: string;
  weight: number;
  date: string;
  trendWeight?: number;
}

export interface LiftingStats {
  bench?: { kg: number; reps: number };
  squat?: { kg: number; reps: number };
  ohp?: { kg: number; reps: number };
  chinup?: { kg: number; reps: number };
  deadlift?: { kg: number; reps: number };
}

export interface UserProfile {
  id: string;
  email: string;
  age: number | null;
  sex: 'male' | 'female' | null;
  heightCm: number | null;
  currentWeight: number | null;
  goal: 'cut' | 'bulk' | 'recomp';
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  trainingDaysPerWeek: number;
  dietPreference: string;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  stressLevel?: 'low' | 'moderate' | 'high';
  bodyFatPct?: number | null;
  liftingStats?: LiftingStats | null;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  currentStreak: number;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'cancelled';
  trialEndsAt: string | null;
  preferredUnits: 'metric' | 'imperial';
  language: 'en' | 'ro';
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MeasurementCategory =
  'chest' | 'waist' | 'hips' | 'arms' | 'thighs' | 'calves' | 'shoulders' | 'neck';

export interface BodyMeasurement {
  id: string;
  user_id: string;
  category: MeasurementCategory;
  value_cm: number;
  date: string;       // 'yyyy-MM-dd'
  created_at: string;
}

export interface FoodRecognitionResult {
  foodName: string;
  confidence: number;
  matchedFood?: Food;
}