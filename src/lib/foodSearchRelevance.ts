export type FoodSearchIntentType =
  | 'protein-snack'
  | 'branded-product'
  | 'meal'
  | 'ingredient'
  | 'local-product'
  | 'ambiguous'

export interface USDAResult {
  fdcId: number
  name: string
  kcalPer100g: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  brandOwner?: string
  brandName?: string
  dataType?: string
  source?: 'USDA'
  foodCategory?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  packageWeight?: string
  servingText?: string
  confidence?: 'high' | 'medium' | 'low'
  matchScore?: number
  lowConfidence?: boolean
  reason?: string
}

export interface SearchCandidate extends USDAResult {
  dataType: string
  brandOwner: string
  brandName: string
  foodCategory: string
  ingredients: string
  sourceIndex: number
}

export interface USDAFood {
  fdcId?: number
  description?: string
  dataType?: string
  brandOwner?: string
  brandName?: string
  foodCategory?: string
  ingredients?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  packageWeight?: string
  foodNutrients?: Array<{ nutrientId?: number; nutrientNumber?: string; value?: number }>
}

export interface FoodSearchIntent {
  query: string
  sourceQuery: string
  type: FoodSearchIntentType
  queryTokens: string[]
  rawTokens: string[]
  importantTokens: string[]
  nonBrandImportantTokens: string[]
  productTokens: string[]
  brandTokens: string[]
  brandNames: string[]
  localBrandNames: string[]
  dataTypes: string[]
  dataTypeGroups: string[]
  stateIntent: 'raw' | 'cooked' | 'dry' | null
  isProteinQuery: boolean
}

export interface FoodSearchPayload {
  results: USDAResult[]
  intentType: FoodSearchIntentType
  lowConfidence: boolean
  fallbackReason: string | null
  sourceStrategy: string
}

type NutritionField = 'kcalPer100g' | 'protein' | 'carbs' | 'fat' | 'fiber'

const NUTRIENT_BY_ID: Record<number, NutritionField> = {
  1008: 'kcalPer100g',
  2047: 'kcalPer100g',
  2048: 'kcalPer100g',
  1003: 'protein',
  1005: 'carbs',
  1004: 'fat',
  1079: 'fiber',
}

const NUTRIENT_BY_NUMBER: Record<string, NutritionField> = {
  '208': 'kcalPer100g',
  '203': 'protein',
  '205': 'carbs',
  '204': 'fat',
  '291': 'fiber',
}

const STOP_TOKENS = new Set(['and', 'with', 'the', 'a', 'an', 'of', 'to', 'for', 'or'])

const PROTEIN_SNACK_TOKENS = new Set([
  'bar',
  'brownie',
  'muffin',
  'cookie',
  'pudding',
  'pancake',
  'shake',
  'yogurt',
  'skyr',
  'whey',
])

const PRODUCT_TOKENS = new Set([
  ...PROTEIN_SNACK_TOKENS,
  'cozonac',
  'milk',
])

const KNOWN_PRODUCT_BRANDS = [
  'quest',
  'myprotein',
  'grenade',
  'barebells',
]

const LOCAL_BRANDS = [
  'lidl',
  'kaufland',
  'pilos',
  'milbona',
  'zuzu',
  'napolact',
  'alesto',
  'boromir',
]

const MEAL_TERMS = [
  'chicken and rice',
  'pizza',
  'burger',
  'lasagna',
  'shawarma',
  'sandwich',
  'omelette',
  'omelet',
  'salad',
  'soup',
  'pancake',
  'pancakes',
  'cereal',
]

const INGREDIENT_TERMS = [
  'chicken breast',
  'lean beef mince',
  'lean ground beef',
  'ground beef',
  'eggs',
  'egg',
  'rice',
  'potato',
  'sweet potato',
  'oats',
  'oat',
  'banana',
  'peanut butter',
  'olive oil',
  'pasta',
  'salmon',
  'tuna',
  'milk',
  'greek yogurt',
  'skyr',
]

const PROCESSED_NOISE_TERMS = [
  'babyfood',
  'breaded',
  'candy',
  'candies',
  'condensed',
  'cracker',
  'deli',
  'dressing',
  'flour',
  'fried',
  'juice',
  'lunchmeat',
  'marinade',
  'nugget',
  'patty',
  'roll',
  'sauce',
  'sausage',
  'spaghetti',
  'tender',
]

const BASIC_FOOD_CATEGORIES = new Set([
  'Fruits and Fruit Juices',
  'Vegetables and Vegetable Products',
  'Poultry Products',
  'Cereal Grains and Pasta',
  'Dairy and Egg Products',
  'Finfish and Shellfish Products',
  'Legumes and Legume Products',
  'Nut and Seed Products',
  'Fats and Oils',
])

const MEAL_FOOD_CATEGORIES = [
  'pizza',
  'burger',
  'sandwich',
  'soup',
  'salad',
  'chicken',
  'egg',
  'omelet',
  'omelette',
  'pancake',
  'cereal',
  'meals',
  'entrees',
]

export function stemToken(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`
  if (token.endsWith('oes') && token.length > 4) return token.slice(0, -2)
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) return token.slice(0, -1)
  return token
}

export function getStemmedTokens(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).map(stemToken)
}

function getRawTokens(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? []
}

function getMeaningfulTokens(value: string): string[] {
  return getStemmedTokens(value).filter(token => token.length > 1 && !STOP_TOKENS.has(token))
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasTerm(value: string, term: string): boolean {
  const escaped = escapeRegex(term).replace(/[-\s]+/g, '[-\\s]+')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(value)
}

function tokenSetHas(tokens: Set<string>, token: string): boolean {
  const stemmed = stemToken(token)
  return tokens.has(stemmed) || tokens.has(token)
}

function getStateIntent(tokens: string[]): FoodSearchIntent['stateIntent'] {
  if (tokens.some(token => ['raw', 'uncooked'].includes(token))) return 'raw'
  if (tokens.some(token => ['dry', 'dried'].includes(token))) return 'dry'
  if (tokens.some(token => ['cooked', 'boiled', 'grilled', 'roasted', 'baked', 'stewed'].includes(token))) return 'cooked'
  return null
}

function getMatchedBrands(queryTokens: string[], brands: string[]): string[] {
  const tokenSet = new Set(queryTokens)
  return brands.filter(brand => getStemmedTokens(brand).every(token => tokenSet.has(token)))
}

function buildSourceQuery(query: string, tokens: string[]): string {
  let sourceQuery = query
  if (tokens.includes('mince') || tokens.includes('minced')) {
    sourceQuery = sourceQuery.replace(/\bminced?\b/gi, 'ground')
  }
  if (/\blean\s+beef\s+(?:mince|ground)\b/i.test(sourceQuery)) {
    sourceQuery = 'lean ground beef'
  }
  return sourceQuery
}

export function detectFoodSearchIntent(query: string): FoodSearchIntent {
  const rawTokens = getRawTokens(query)
  const queryTokens = getStemmedTokens(query)
  const importantTokens = getMeaningfulTokens(query)
  const queryText = query.toLowerCase()
  const productBrandNames = getMatchedBrands(queryTokens, KNOWN_PRODUCT_BRANDS)
  const localBrandNames = getMatchedBrands(queryTokens, LOCAL_BRANDS)
  const brandNames = [...productBrandNames, ...localBrandNames]
  const brandTokens = brandNames.flatMap(getStemmedTokens)
  const brandTokenSet = new Set(brandTokens)
  const nonBrandImportantTokens = importantTokens.filter(token => !brandTokenSet.has(token))
  const tokenSet = new Set(queryTokens)
  const productTokens = importantTokens.filter(token => PRODUCT_TOKENS.has(token))
  const hasProteinWord = tokenSet.has('protein') || tokenSet.has('whey')
  const hasProteinSnackToken = productTokens.some(token => PROTEIN_SNACK_TOKENS.has(token))
  const isProteinQuery = hasProteinWord || productTokens.includes('skyr')
  const isProteinSnack = hasProteinWord && hasProteinSnackToken
  const isLocal = localBrandNames.length > 0
  const isBranded = productBrandNames.length > 0
  const isMeal = MEAL_TERMS.some(term => hasTerm(queryText, term))
  const isIngredient = INGREDIENT_TERMS.some(term => hasTerm(queryText, term))
  const isSnackAmbiguous = productTokens.some(token => ['bar', 'brownie', 'muffin', 'cookie'].includes(token))

  let type: FoodSearchIntentType = 'ambiguous'
  if (isLocal) type = 'local-product'
  else if (isBranded) type = 'branded-product'
  else if (isProteinSnack) type = 'protein-snack'
  else if (hasTerm(queryText, 'chicken and rice')) type = 'meal'
  else if (isMeal && !isIngredient) type = 'meal'
  else if (isIngredient) type = 'ingredient'
  else if (isSnackAmbiguous) type = 'ambiguous'

  const dataTypeGroups = (() => {
    if (type === 'local-product' || type === 'branded-product' || type === 'protein-snack') {
      return ['Branded', 'SR Legacy,Survey (FNDDS)', 'Foundation,SR Legacy']
    }
    if (type === 'meal') return ['SR Legacy,Survey (FNDDS)', 'Foundation,SR Legacy']
    if (type === 'ambiguous' && productTokens.length > 0) {
      return ['SR Legacy,Survey (FNDDS)', 'Branded', 'Foundation,SR Legacy']
    }
    return ['Foundation,SR Legacy']
  })()
  const dataTypes = [...new Set(dataTypeGroups.flatMap(group => group.split(',').map(value => value.trim())))]

  return {
    query,
    sourceQuery: buildSourceQuery(query, queryTokens),
    type,
    queryTokens,
    rawTokens,
    importantTokens,
    nonBrandImportantTokens,
    productTokens,
    brandTokens,
    brandNames,
    localBrandNames,
    dataTypes,
    dataTypeGroups,
    stateIntent: getStateIntent(queryTokens),
    isProteinQuery,
  }
}

export function getFoodSearchCandidatePageSize(intent: FoodSearchIntent, pageSize: number): number {
  if (intent.dataTypeGroups.length > 1) return Math.max(pageSize, 50)
  return Math.max(pageSize, 100)
}

export function sanitizeNutritionValue(value: number): number {
  if (!Number.isFinite(value)) return 0
  const rounded = Math.round(value * 10) / 10
  return rounded < 0 || Object.is(rounded, -0) ? 0 : rounded
}

function servingText(food: USDAFood): string {
  const parts = []
  if (food.householdServingFullText) parts.push(food.householdServingFullText)
  if (typeof food.servingSize === 'number' && food.servingSizeUnit) {
    parts.push(`${food.servingSize}${food.servingSizeUnit}`)
  }
  if (food.packageWeight) parts.push(food.packageWeight)
  return parts.join(' | ')
}

export function normalizeUSDAFood(food: USDAFood, sourceIndex: number): SearchCandidate {
  const result: SearchCandidate = {
    fdcId: food.fdcId ?? 0,
    name: food.description ?? '',
    kcalPer100g: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    brandOwner: food.brandOwner ?? '',
    brandName: food.brandName ?? '',
    dataType: food.dataType ?? '',
    source: 'USDA',
    foodCategory: food.foodCategory ?? '',
    ingredients: food.ingredients ?? '',
    servingSize: food.servingSize,
    servingSizeUnit: food.servingSizeUnit,
    householdServingFullText: food.householdServingFullText,
    packageWeight: food.packageWeight,
    servingText: servingText(food),
    sourceIndex,
  }

  for (const nutrient of food.foodNutrients ?? []) {
    const byId = typeof nutrient.nutrientId === 'number'
      ? NUTRIENT_BY_ID[nutrient.nutrientId]
      : undefined
    const byNumber = nutrient.nutrientNumber
      ? NUTRIENT_BY_NUMBER[String(nutrient.nutrientNumber)]
      : undefined
    const field = byId ?? byNumber
    if (field && typeof nutrient.value === 'number') {
      result[field] = sanitizeNutritionValue(nutrient.value)
    }
  }

  return result
}

function fullCandidateText(candidate: SearchCandidate): string {
  return [
    candidate.name,
    candidate.brandOwner,
    candidate.brandName,
    candidate.foodCategory,
    candidate.ingredients,
  ].filter(Boolean).join(' ').toLowerCase()
}

function macroComplete(candidate: SearchCandidate): boolean {
  return [candidate.kcalPer100g, candidate.protein, candidate.carbs, candidate.fat]
    .every(value => Number.isFinite(value) && value >= 0)
    && candidate.kcalPer100g > 0
}

function servingClear(candidate: SearchCandidate): boolean {
  return Boolean(candidate.servingText)
    || candidate.dataType === 'Foundation'
    || candidate.dataType === 'SR Legacy'
    || candidate.dataType === 'Survey (FNDDS)'
}

function proteinPlausible(intent: FoodSearchIntent, candidate: SearchCandidate): boolean {
  if (!intent.isProteinQuery) return true
  const text = fullCandidateText(candidate)
  if (candidate.protein >= 18 && /\b(protein|whey|bar|shake|skyr)\b/i.test(text)) return true
  if (candidate.protein >= 9 && /\b(greek|yogurt|skyr|pudding)\b/i.test(text)) return true
  if (candidate.protein >= 12 && /\b(cookie|brownie|muffin|pancake)\b/i.test(text)) return true
  return candidate.protein >= 20
}

function importantTokenStats(intent: FoodSearchIntent, candidate: SearchCandidate) {
  const text = fullCandidateText(candidate)
  const tokens = new Set(getStemmedTokens(text))
  const targetTokens = intent.type === 'local-product'
    ? intent.nonBrandImportantTokens
    : intent.importantTokens
  const matched = targetTokens.filter(token => {
    if (token === 'mince' && /\b(ground|mince|minced)\b/i.test(text)) return true
    return tokenSetHas(tokens, token) || hasTerm(text, token)
  })
  return {
    matched,
    missing: targetTokens.filter(token => !matched.includes(token)),
    allPresent: targetTokens.length > 0 && matched.length === targetTokens.length,
  }
}

function productTokenStats(intent: FoodSearchIntent, candidate: SearchCandidate) {
  const text = fullCandidateText(candidate)
  const tokens = new Set(getStemmedTokens(text))
  const required = intent.productTokens.filter(token => token !== 'protein')
  const matched = required.filter(token => tokenSetHas(tokens, token) || hasTerm(text, token))
  return {
    required,
    matched,
    missing: required.filter(token => !matched.includes(token)),
  }
}

function hasBrandMatch(intent: FoodSearchIntent, candidate: SearchCandidate): boolean {
  if (intent.brandTokens.length === 0) return true
  const textTokens = new Set(getStemmedTokens(fullCandidateText(candidate)))
  return intent.brandTokens.every(token => tokenSetHas(textTokens, token))
}

function scoreDataType(intent: FoodSearchIntent, candidate: SearchCandidate): number {
  if (intent.type === 'protein-snack' || intent.type === 'branded-product' || intent.type === 'local-product') {
    if (candidate.dataType === 'Branded') return 34
    if (candidate.dataType === 'Survey (FNDDS)') return 14
    if (candidate.dataType === 'SR Legacy') return 10
    return -12
  }
  if (intent.type === 'meal') {
    if (candidate.dataType === 'Survey (FNDDS)') return 34
    if (candidate.dataType === 'SR Legacy') return 12
    if (candidate.dataType === 'Foundation') return -6
    return -18
  }
  if (intent.type === 'ingredient') {
    if (candidate.dataType === 'Foundation') return 30
    if (candidate.dataType === 'SR Legacy') return 20
    if (candidate.dataType === 'Survey (FNDDS)') return -10
    return -34
  }
  if (candidate.dataType === 'Survey (FNDDS)') return 16
  if (candidate.dataType === 'SR Legacy') return 12
  if (candidate.dataType === 'Foundation') return 8
  return -2
}

function applySpecificScoring(intent: FoodSearchIntent, candidate: SearchCandidate): number {
  const text = fullCandidateText(candidate)
  const name = candidate.name.toLowerCase()
  const query = intent.importantTokens.join(' ')
  let score = 0

  if (query === 'lean beef mince' || query === 'lean beef ground' || intent.query.toLowerCase().includes('lean beef mince')) {
    if (/\bbeef\b/i.test(text)) score += 70
    if (/\b(ground|mince|minced)\b/i.test(text)) score += 95
    if (/\blean\b/i.test(text)) score += 28
    if (/\b(ham|pork|lamb|pie)\b/i.test(text) && !/\bbeef\b/i.test(text)) score -= 190
    if (/\b(carcass|ribeye|sirloin|steak)\b/i.test(text) && !/\b(ground|mince|minced)\b/i.test(text)) score -= 58
  }

  if (intent.queryTokens.includes('greek') && intent.queryTokens.includes('yogurt')) {
    if (/\byogurt\b/i.test(text)) score += 50
    if (/\bgreek\b/i.test(text)) score += 72
    if (/\b(ocean spray|cranberries|dessert|coated)\b/i.test(text)) score -= 80
  }

  if (intent.queryTokens.includes('skyr')) {
    if (/\bskyr\b/i.test(text)) score += 110
    if (/\byogurt\b/i.test(text)) score += 24
    if (/\b(cheesecake|cake|dessert)\b/i.test(text)) score -= 70
  }

  if (intent.queryTokens.includes('chicken') && intent.queryTokens.includes('breast')) {
    if (/\bchicken\b/i.test(text)) score += 35
    if (/\bbreast\b/i.test(text)) score += 60
    if (/\bboneless\b/i.test(text)) score += 12
    if (/\bskinless\b/i.test(text)) score += 10
    if (/\b(raw|roasted|cooked|grilled)\b/i.test(text)) score += 24
    if (/\b(breaded|tender|roll|deli|lunchmeat|glazed|patty|sliced|flavor|fat-free|mesquite|prepackaged)\b/i.test(text)) score -= 120
  }

  if (intent.queryTokens.includes('chicken') && intent.stateIntent && !intent.queryTokens.includes('rice')) {
    const isPlainChicken = /\bchicken\b/i.test(text)
      && /\b(meat|breast|thigh|leg|drumstick|wing|ground|broiler|fryer|roasting|stewing|poultry)\b/i.test(text)
    const isProcessedChicken = /\b(bratwurst|sausage|frankfurter|hot dog|nugget|patty|breaded|tender|deli|lunchmeat|roll|bologna|salami|jerky|spread|salad|sandwich)\b/i.test(text)

    if (/\bchicken\b/i.test(text)) score += 35
    if (candidate.foodCategory === 'Poultry Products') score += 42
    if (isPlainChicken) score += 92

    if (intent.stateIntent === 'cooked') {
      if (/\b(cooked|roasted|grilled|stewed|broiled|braised|baked)\b/i.test(text)) score += 96
      if (/\b(raw|uncooked)\b/i.test(text)) score -= 70
    }

    if (intent.stateIntent === 'raw') {
      if (/\b(raw|uncooked)\b/i.test(text)) score += 102
      if (/\b(cooked|roasted|grilled|stewed|broiled|braised|baked)\b/i.test(text)) score -= 76
    }

    if (isProcessedChicken) score -= 230
    if (candidate.foodCategory === 'Sausages and Luncheon Meats') score -= 150
  }

  if (intent.queryTokens.includes('olive') && intent.queryTokens.includes('oil')) {
    const isPureOliveOil = /\b(oil,\s*olive|olive oil)\b/i.test(text)
      && candidate.fat >= 80
      && candidate.protein <= 1
      && candidate.carbs <= 1
    if (isPureOliveOil) score += 260
    if (/\bolive oil\b/i.test(text) && !isPureOliveOil) score -= 170
    if (/\b(anchov|fish|sardine|olives?|stuffed)\b/i.test(text) && !isPureOliveOil) score -= 170
  }

  if (intent.queryTokens.includes('rice')) {
    if (/\brice\b/i.test(text)) score += 35
    if (intent.stateIntent === 'cooked') {
      if (/\b(cooked|boiled)\b/i.test(text)) score += 95
      if (/\b(raw|dry|dried|uncooked)\b/i.test(text)) score -= 75
    } else if (intent.stateIntent === 'dry' || intent.stateIntent === 'raw') {
      if (/\b(raw|dry|dried|uncooked)\b/i.test(text)) score += 95
      if (/\bcooked\b/i.test(text)) score -= 55
    } else {
      if (/\bcooked\b/i.test(text)) score += 34
      if (/\b(raw|dry|dried|uncooked)\b/i.test(text)) score -= 18
    }
    if (/\b(white|brown)\b/i.test(text)) score += 18
    if (/^rice\b/i.test(name)) score += 28
    if (/\b(noodle|cracker|cake|snack|milk|oil|pudding)\b/i.test(text) && intent.importantTokens.length <= 2) score -= 108
  }

  if (intent.queryTokens.includes('egg')) {
    if (/\beggs?,?\s*(grade a|whole|raw|fresh)?\b/i.test(text)) score += 50
    if (/\begg white\b/i.test(text) && !intent.queryTokens.includes('white')) score -= 34
    if (/\b(candy|chocolate|substitute|powder|dried)\b/i.test(text)) score -= 65
  }

  if (intent.queryTokens.includes('oat')) {
    if (/\b(oats?|rolled|steel[-\s]?cut|old[-\s]?fashioned)\b/i.test(text)) score += 50
    if (/\b(oil|bagel|bread|muffin|bar|granola)\b/i.test(text)) score -= 42
  }

  if (intent.queryTokens.includes('salmon') || intent.queryTokens.includes('tuna')) {
    if (/\b(fish|finfish|salmon|tuna)\b/i.test(text)) score += 32
    if (/\b(nugget|patty|salad|spread|breaded)\b/i.test(text)) score -= 58
  }

  if (intent.queryTokens.includes('milk') && intent.importantTokens.length <= 2) {
    if (/^milk\b/i.test(name)) score += 120
    if (/\b(fluid|whole|lowfat|nonfat|reduced[-\s]fat|skim|milkfat)\b/i.test(text)) score += 48
    if (/\b(caramel|candy|candies|cheese|ricotta|yogurt|butter|cream|condensed|shake|chocolate|rice milk|oat milk|almond|coconut|dessert|powder|human)\b/i.test(text)) score -= 120
  }

  if (intent.type === 'meal') {
    if (MEAL_FOOD_CATEGORIES.some(term => hasTerm(candidate.foodCategory.toLowerCase(), term) || hasTerm(text, term))) score += 28
    if (intent.queryTokens.includes('pizza') && /\b(breadstick|sauce|crust only|dessert)\b/i.test(text)) score -= 92
    if (intent.queryTokens.includes('salad') && /\bdressing\b/i.test(text)) score -= 95
    if (intent.queryTokens.includes('soup') && /\bbroth\b/i.test(text) && !/\bsoup\b/i.test(name)) score -= 42
    if (intent.queryTokens.includes('sandwich')) {
      if (/\b(sandwich,|chicken sandwich|beef sandwich|egg sandwich|cheese sandwich|ham sandwich|turkey sandwich)\b/i.test(text)) score += 54
      if (/\b(cracker|spread)\b/i.test(text)) score -= 210
    }
    if (intent.queryTokens.includes('pancake') && /\bpotato\b/i.test(text)) score -= 62
    if (intent.query.toLowerCase() === 'chicken and rice') {
      if (/\bchicken\b/i.test(text) && /\brice\b/i.test(text)) score += 90
      if (/\bbabyfood\b/i.test(text)) score -= 80
    }
  }

  if (intent.queryTokens.includes('yogurt')) {
    if (/\byogurt\b/i.test(text)) score += 90
    if (/\b(protein yogurt|yogurt, fruit|greek yogurt|plain yogurt|skyr)\b/i.test(text)) score += 60
    if (/\b(oatmeal bar|bar|drizzle|coating|raisin|covered|pretzel)\b/i.test(text)) score -= 240
  }

  return score
}

function scoreCandidate(intent: FoodSearchIntent, candidate: SearchCandidate): number {
  const text = fullCandidateText(candidate)
  const normalizedQuery = intent.query.toLowerCase().replace(/\s+/g, ' ').trim()
  const tokenStats = importantTokenStats(intent, candidate)
  const productStats = productTokenStats(intent, candidate)
  const brandMatched = hasBrandMatch(intent, candidate)
  const productMissing = productStats.missing.length > 0
  let score = 0

  if (text.includes(normalizedQuery)) score += 120
  if (candidate.name.toLowerCase().includes(normalizedQuery)) score += 45
  if (tokenStats.allPresent) score += 86
  score += tokenStats.matched.length * 18
  score -= tokenStats.missing.length * 42

  if (productStats.required.length > 0) {
    score += productStats.matched.length * 34
    score -= productStats.missing.length * 110
  }

  if (intent.brandTokens.length > 0) {
    score += brandMatched ? 115 : -74
  }

  score += scoreDataType(intent, candidate)
  if (intent.type === 'local-product' && intent.brandTokens.length > 0 && !brandMatched) {
    if (candidate.dataType === 'Branded') score -= 52
    if (candidate.dataType === 'Foundation' || candidate.dataType === 'SR Legacy') score += 18
  }

  if (macroComplete(candidate)) score += 26
  else score -= 80
  if (servingClear(candidate)) score += 14
  if (candidate.servingText) score += 10

  if (intent.isProteinQuery) {
    if (proteinPlausible(intent, candidate)) score += 42
    else score -= 72
    if (/\bprotein\b/i.test(text)) score += 32
    if (/\bprotein[-\s]?fortified\b/i.test(text) && productMissing) score -= 105
    if (/\b(spaghetti|pasta|milk)\b/i.test(text) && productMissing && !intent.queryTokens.some(token => ['pasta', 'milk'].includes(token))) {
      score -= 118
    }
  }

  if (intent.type === 'ingredient' && BASIC_FOOD_CATEGORIES.has(candidate.foodCategory)) score += 20
  if (intent.type === 'ingredient' && candidate.dataType === 'Branded') score -= 36

  const noisyTerms = PROCESSED_NOISE_TERMS.filter(term =>
    !intent.queryTokens.includes(stemToken(term)) && hasTerm(text, term)
  )
  score -= Math.min(88, noisyTerms.length * 18)

  if (intent.type === 'ambiguous' && intent.queryTokens.length === 1 && intent.queryTokens[0] === 'bar') {
    score -= 80
  }

  score += applySpecificScoring(intent, candidate)

  return score
}

function confidenceFor(intent: FoodSearchIntent, candidate: SearchCandidate, score: number): USDAResult['confidence'] {
  const tokenStats = importantTokenStats(intent, candidate)
  const productStats = productTokenStats(intent, candidate)
  const brandMatched = hasBrandMatch(intent, candidate)
  const productMissing = productStats.missing.length > 0

  if (!macroComplete(candidate)) return 'low'
  if (intent.brandTokens.length > 0 && !brandMatched) return 'low'
  if (intent.type === 'local-product' && intent.brandTokens.length > 0 && !brandMatched) return 'low'
  if (intent.isProteinQuery && (!proteinPlausible(intent, candidate) || productMissing)) return 'low'
  if (!tokenStats.allPresent && intent.type !== 'local-product') return 'low'
  if (intent.type === 'ambiguous' && intent.queryTokens.join(' ') === 'bar') return 'low'
  if (score >= 175) return 'high'
  if (score >= 95) return 'medium'
  return 'low'
}

function reasonFor(intent: FoodSearchIntent, candidate: SearchCandidate, confidence: USDAResult['confidence']): string {
  if (confidence !== 'low') {
    if (candidate.dataType === 'Branded' && hasBrandMatch(intent, candidate)) return 'Strong branded match'
    if (intent.type === 'ingredient') return 'Strong generic ingredient match'
    if (intent.type === 'meal') return 'Prepared-food match'
    return 'Strong token match'
  }
  if (intent.type === 'local-product') return 'Generic alternative; exact local brand may not be in USDA'
  if (intent.brandTokens.length > 0) return 'Exact brand not confirmed'
  if (intent.isProteinQuery) return 'Protein/product match is weak'
  return 'Lower-confidence USDA match'
}

function dedupeCandidates(candidates: SearchCandidate[]): SearchCandidate[] {
  const seen = new Set<string>()
  const deduped: SearchCandidate[] = []
  for (const candidate of candidates) {
    const brand = (candidate.brandOwner || candidate.brandName || '').toLowerCase().trim()
    const key = [
      candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      brand,
      Math.round(candidate.kcalPer100g),
      Math.round(candidate.protein),
      Math.round(candidate.carbs),
      Math.round(candidate.fat),
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(candidate)
  }
  return deduped
}

function fallbackReasonFor(intent: FoodSearchIntent, results: USDAResult[]): string | null {
  if (results.length === 0) {
    if (intent.type === 'local-product') {
      return 'No strong match found. USDA rarely has exact Romanian retail products; try AI Describe for the label.'
    }
    return 'No strong match found. Try AI Describe or simplify the search.'
  }
  const top = results[0]
  if (!top.lowConfidence) return null
  if (intent.type === 'local-product') {
    return 'No strong match found. USDA may not have this exact local brand; use AI Describe for the package label or choose a generic estimate below.'
  }
  if (intent.type === 'branded-product') {
    return 'No strong match found for that brand. Use AI Describe for the label or choose a lower-confidence estimate below.'
  }
  if (intent.isProteinQuery) {
    return 'No strong protein-snack match found. Use AI Describe for the label or choose a lower-confidence estimate below.'
  }
  return 'No strong match found. Choose carefully or try AI Describe.'
}

export function rankFoodSearchResults(
  candidates: SearchCandidate[],
  intent: FoodSearchIntent,
  pageSize: number,
): FoodSearchPayload {
  const scored = dedupeCandidates(candidates)
    .filter(candidate => candidate.kcalPer100g > 0 && candidate.name.trim())
    .map(candidate => {
      const score = scoreCandidate(intent, candidate)
      const confidence = confidenceFor(intent, candidate, score)
      const result: USDAResult = {
        fdcId: candidate.fdcId,
        name: candidate.name,
        kcalPer100g: candidate.kcalPer100g,
        protein: candidate.protein,
        carbs: candidate.carbs,
        fat: candidate.fat,
        fiber: candidate.fiber,
        brandOwner: candidate.brandOwner || undefined,
        brandName: candidate.brandName || undefined,
        dataType: candidate.dataType || undefined,
        source: 'USDA',
        foodCategory: candidate.foodCategory || undefined,
        servingSize: candidate.servingSize,
        servingSizeUnit: candidate.servingSizeUnit,
        householdServingFullText: candidate.householdServingFullText,
        packageWeight: candidate.packageWeight,
        servingText: candidate.servingText || undefined,
        confidence,
        matchScore: Math.round(score),
        lowConfidence: confidence === 'low',
        reason: reasonFor(intent, candidate, confidence),
      }
      return { candidate, score, result }
    })
    .sort((a, b) => (b.score - a.score) || (a.candidate.sourceIndex - b.candidate.sourceIndex))

  const results = scored.slice(0, pageSize).map(row => row.result)
  const fallbackReason = fallbackReasonFor(intent, results)
  return {
    results,
    intentType: intent.type,
    lowConfidence: Boolean(fallbackReason),
    fallbackReason,
    sourceStrategy: intent.dataTypeGroups.join(' | '),
  }
}
