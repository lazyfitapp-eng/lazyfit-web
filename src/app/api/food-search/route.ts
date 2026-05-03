import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface USDAResult {
  fdcId: number
  name: string
  kcalPer100g: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

interface SearchCandidate extends USDAResult {
  dataType: string
  brandOwner: string
  foodCategory: string
  ingredients: string
  sourceIndex: number
}

interface USDAFood {
  fdcId?: number
  description?: string
  dataType?: string
  brandOwner?: string
  foodCategory?: string
  ingredients?: string
  foodNutrients?: Array<{ nutrientId?: number; value?: number }>
}

// USDA internal nutrientId → field (NOT nutrientNumber)
// Energy=1008 for SR Legacy and 2047/2048 for Foundation.
// Protein=1003, Carbs=1005, Fat=1004, Fiber=1079.
const NUTRIENT_MAP: Record<number, keyof Omit<USDAResult, 'fdcId' | 'name'>> = {
  1008: 'kcalPer100g',
  2047: 'kcalPer100g',
  2048: 'kcalPer100g',
  1003: 'protein',
  1005: 'carbs',
  1004: 'fat',
  1079: 'fiber',
}

// Simple in-memory cache — key = query string, TTL = 10 minutes
const cache = new Map<string, { data: USDAResult[]; at: number }>()
const CACHE_TTL = 10 * 60 * 1000

const BASIC_FOOD_CATEGORIES = new Set([
  'Fruits and Fruit Juices',
  'Vegetables and Vegetable Products',
  'Poultry Products',
  'Cereal Grains and Pasta',
  'Dairy and Egg Products',
])

const PROCESSED_FOOD_CATEGORIES = new Set([
  'Baby Foods',
  'Baked Products',
  'Fast Foods',
  'Fats and Oils',
  'Meals, Entrees, and Side Dishes',
  'Restaurant Foods',
  'Snacks',
  'Sweets',
  'Sausages and Luncheon Meats',
])

const BASIC_DESCRIPTION_TERMS = [
  'baked',
  'boiled',
  'boneless',
  'cooked',
  'flesh and skin',
  'fluid',
  'fresh',
  'long grain',
  'long-grain',
  'medium grain',
  'medium-grain',
  'old fashioned',
  'raw',
  'regular',
  'rolled',
  'short grain',
  'short-grain',
  'skinless',
  'steel cut',
  'whole',
  'with skin',
]

const PROCESSED_DESCRIPTION_TERMS = [
  'babyfood',
  'bagel',
  'bar',
  'bread',
  'breaded',
  'butter',
  'cake',
  'candies',
  'candy',
  'canned',
  'chips',
  'chocolate',
  'condensed',
  'cookie',
  'cracker',
  'croissant',
  'dehydrated',
  'deli',
  'dessert',
  'dried',
  'fast food',
  'flavor',
  'flour',
  'fried',
  'frozen',
  'imitation',
  'juice',
  'lunchmeat',
  'mix',
  'muffin',
  'oil',
  'pancake',
  'pastry',
  'pie',
  'powder',
  'restaurant',
  'roll',
  'sausage',
  'shake',
  'snack',
  'strudel',
  'sulfured',
  'supplement',
  'sweetened',
]

function stemToken(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`
  if (token.endsWith('oes') && token.length > 4) return token.slice(0, -2)
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) return token.slice(0, -1)
  return token
}

function getStemmedTokens(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).map(stemToken)
}

function hasTerm(value: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-\s]+/g, '[-\\s]+')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(value)
}

function termIsInQuery(term: string, queryTokens: string[]): boolean {
  const termTokens = getStemmedTokens(term)
  return termTokens.length > 0 && termTokens.every(token => queryTokens.includes(token))
}

function shouldRerankQuery(query: string, queryTokens: string[]): boolean {
  return queryTokens.length > 0
    && queryTokens.length <= 2
    && queryTokens.every(token => token.length > 1)
    && /^[a-zA-Z][a-zA-Z\s-]*$/.test(query)
}

function scoreFood(candidate: SearchCandidate, queryTokens: string[]): number {
  const description = candidate.name.toLowerCase()
  const descriptionTokens = getStemmedTokens(candidate.name)
  const containsAllQueryTokens = queryTokens.every(token => descriptionTokens.includes(token))
  const leadingMatch = queryTokens.every((token, index) => descriptionTokens[index] === token)
  const queryAsModifier = containsAllQueryTokens && !leadingMatch
  let score = 0

  if (containsAllQueryTokens) score += 20
  else score -= 80
  if (descriptionTokens[0] === queryTokens[0]) score += 35
  if (leadingMatch) score += 70
  if (leadingMatch && descriptionTokens.length === queryTokens.length) score += 120
  if (descriptionTokens.length <= queryTokens.length + 4) score += 12
  else if (descriptionTokens.length <= queryTokens.length + 8) score += 6

  if (candidate.dataType === 'Foundation') score += 22
  if (BASIC_FOOD_CATEGORIES.has(candidate.foodCategory)) score += 26
  if (PROCESSED_FOOD_CATEGORIES.has(candidate.foodCategory)) score -= queryAsModifier ? 50 : 15
  if (queryAsModifier) score -= 55

  if (BASIC_DESCRIPTION_TERMS.some(term => hasTerm(description, term))) score += 18

  const processedTermCount = PROCESSED_DESCRIPTION_TERMS.filter(term =>
    !termIsInQuery(term, queryTokens) && hasTerm(description, term)
  ).length
  score -= Math.min(72, processedTermCount * 18)

  const query = queryTokens.join(' ')
  if (query === 'milk') {
    if (/\b(fluid|whole|lowfat|nonfat|reduced[-\s]fat|skim)\b/i.test(description)) score += 24
    if (/\b(3\.25%|1% milkfat|2% milkfat|fat free)\b/i.test(description)) score += 18
    if (/\b(sheep|goat|buffalo|human|producer|rice milk|oat milk|soy|almond|coconut|buttermilk|condensed|dessert|shake|chocolate|supplement|imitation|filled|dry|low sodium)\b/i.test(description)) score -= 34
  }

  if (query === 'rice') {
    if (/\b(white|brown)\b/i.test(description)) score += 24
    if (/\b(cooked|raw)\b/i.test(description)) score += 12
    if (/\b(long[-\s]grain|medium[-\s]grain|short[-\s]grain)\b/i.test(description)) score += 12
    if (/\b(black|red|glutinous|parboiled|noodles|cracker|cake|snack|vermicelli|pilaf|flour|bran|milk|oil)\b/i.test(description)) score -= 24
  }

  if (query === 'oat') {
    if (descriptionTokens[0] === 'oat') score += 18
    if (/\b(oats|rolled|steel[-\s]cut|old[-\s]fashioned)\b/i.test(description)) score += 24
    if (/\b(oil|bagel|bread|muffin|bar|granola)\b/i.test(description)) score -= 24
  }

  if (query === 'egg') {
    if (/\beggs,\s*grade a\b/i.test(description)) score += 40
    if (/\begg whole\b/i.test(description)) score += 14
    if (/\b(raw|fresh)\b/i.test(description)) score += 12
    if (/\b(dried|frozen|pasteurized|substitute|powder|omelet|fried|scrambled)\b/i.test(description)) score -= 36
  }

  if (query === 'chicken breast') {
    if (/\braw\b/i.test(description)) score += 42
    if (/\b(roasted|stewed|cooked)\b/i.test(description)) score += 12
    if (/\b(breaded|tender|lunchmeat|deli|roll|sliced|prepackaged|fat-free|mesquite|honey glazed)\b/i.test(description)) score -= 90
  }

  return score
}

function stripSearchMetadata(candidate: SearchCandidate): USDAResult {
  return {
    fdcId: candidate.fdcId,
    name: candidate.name,
    kcalPer100g: candidate.kcalPer100g,
    protein: candidate.protein,
    carbs: candidate.carbs,
    fat: candidate.fat,
    fiber: candidate.fiber,
  }
}

function rerankFoods(candidates: SearchCandidate[], query: string, pageSize: number): USDAResult[] {
  const queryTokens = getStemmedTokens(query)
  if (!shouldRerankQuery(query, queryTokens)) {
    return candidates.slice(0, pageSize).map(stripSearchMetadata)
  }

  return [...candidates]
    .sort((a, b) => {
      const scoreDiff = scoreFood(b, queryTokens) - scoreFood(a, queryTokens)
      return scoreDiff || a.sourceIndex - b.sourceIndex
    })
    .slice(0, pageSize)
    .map(stripSearchMetadata)
}

export async function GET(req: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ results: [] })

  const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '8'), 20)
  const queryTokens = getStemmedTokens(q)
  const candidatePageSize = shouldRerankQuery(q, queryTokens) ? Math.max(pageSize, 100) : pageSize
  const cacheKey = `${q}:${pageSize}:rank-v2`

  // Return cached result if fresh
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json({ results: cached.data })
  }

  const apiKey = process.env.USDA_API_KEY ?? 'DEMO_KEY'
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
  url.searchParams.set('query', q)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('dataType', 'Foundation,SR Legacy')
  url.searchParams.set('pageSize', String(candidatePageSize))
  url.searchParams.set('nutrients', '203,204,205,208,291')

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 600 } })
    if (!res.ok) return NextResponse.json({ error: `USDA API error ${res.status}`, results: [] }, { status: 502 })

    const json = await res.json()
    const candidates: SearchCandidate[] = ((json.foods ?? []) as USDAFood[]).map((food, sourceIndex) => {
      const result: SearchCandidate = {
        fdcId: food.fdcId ?? 0,
        name: food.description ?? '',
        kcalPer100g: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        dataType: food.dataType ?? '',
        brandOwner: food.brandOwner ?? '',
        foodCategory: food.foodCategory ?? '',
        ingredients: food.ingredients ?? '',
        sourceIndex,
      }
      for (const n of food.foodNutrients ?? []) {
        const field = typeof n.nutrientId === 'number' ? NUTRIENT_MAP[n.nutrientId] : undefined
        if (field && typeof n.value === 'number') result[field] = Math.round(n.value * 10) / 10
      }
      return result
    }).filter((r: SearchCandidate) => r.kcalPer100g > 0)

    const foods = rerankFoods(candidates, q, pageSize)
    cache.set(cacheKey, { data: foods, at: Date.now() })
    return NextResponse.json({ results: foods })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
