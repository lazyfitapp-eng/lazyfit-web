export interface FoodAmbiguityIssue {
  message: string
  blocking: boolean
}

const DENSE_TERMS = [
  { pattern: /\bolive\s+oil\b/i, label: 'Olive oil' },
  { pattern: /\bsunflower\s+oil\b/i, label: 'Sunflower oil' },
  { pattern: /\boil\b/i, label: 'Oil' },
  { pattern: /\bbutter\b/i, label: 'Butter' },
  { pattern: /\bghee\b/i, label: 'Ghee' },
  { pattern: /\bdressing\b/i, label: 'Dressing' },
  { pattern: /\bmayonnaise\b/i, label: 'Mayonnaise' },
  { pattern: /\bmayo\b/i, label: 'Mayo' },
  { pattern: /\bcream\b/i, label: 'Cream' },
  { pattern: /\bsauce\b/i, label: 'Sauce' },
  { pattern: /\bpan[-\s]?fried\b/i, label: 'Pan-fried fat' },
  { pattern: /\bfried\b/i, label: 'Frying fat' },
  { pattern: /\bsauteed\b/i, label: 'Sauteed fat' },
  { pattern: /\bcooked\s+with\s+oil\b/i, label: 'Oil' },
  { pattern: /\bwith\s+oil\b/i, label: 'Oil' },
]

const QUANTITY_NEAR_TERM = /(?:\d+(?:[.,]\d+)?\s*(?:g|gram|grams|ml|tsp|teaspoon|teaspoons|tbsp|tablespoon|tablespoons)\b)|(?:\b(?:one|two|half)\s+(?:tsp|teaspoon|teaspoons|tbsp|tablespoon|tablespoons)\b)/i
const GRAMS = /\b\d+(?:[.,]\d+)?\s*g(?:ram|rams)?\b/i
const COOKING_STATE = /\b(raw|cooked|dry|boiled|grilled|baked|roasted|fried|pan[-\s]?fried|sauteed)\b/i

function hasQuantityNear(text: string, index: number, length: number): boolean {
  const start = Math.max(0, index - 28)
  const end = Math.min(text.length, index + length + 28)
  return QUANTITY_NEAR_TERM.test(text.slice(start, end))
}

export function detectFoodAmbiguity(text: string): FoodAmbiguityIssue[] {
  const cleaned = text.trim()
  if (!cleaned) return []

  const issues: FoodAmbiguityIssue[] = []

  for (const term of DENSE_TERMS) {
    const match = term.pattern.exec(cleaned)
    if (!match || hasQuantityNear(cleaned, match.index, match[0].length)) continue

    issues.push({
      blocking: true,
      message: `${term.label} amount missing. Add quantity like 5g, 10g, 1 tsp, or 1 tbsp.`,
    })
    break
  }

  const hasGrams = GRAMS.test(cleaned)
  const hasCookingState = COOKING_STATE.test(cleaned)

  if (hasGrams && /\b(rice|pasta)\b/i.test(cleaned) && !hasCookingState) {
    issues.push({
      blocking: false,
      message: 'Rice or pasta weight can mean dry or cooked. Assuming cooked weight unless edited.',
    })
  }

  if (hasGrams && /\b(chicken|beef|pork|fish|potato)\b/i.test(cleaned) && !hasCookingState) {
    issues.push({
      blocking: false,
      message: 'Raw vs cooked weight changes calories. Assuming cooked weight unless edited.',
    })
  }

  return issues
}
