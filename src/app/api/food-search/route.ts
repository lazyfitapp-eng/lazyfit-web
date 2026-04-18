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

// USDA internal nutrientId → field (NOT nutrientNumber)
// Energy=1008, Protein=1003, Carbs=1005, Fat=1004, Fiber=1079
const NUTRIENT_MAP: Record<number, keyof Omit<USDAResult, 'fdcId' | 'name'>> = {
  1008: 'kcalPer100g',
  1003: 'protein',
  1005: 'carbs',
  1004: 'fat',
  1079: 'fiber',
}

// Simple in-memory cache — key = query string, TTL = 10 minutes
const cache = new Map<string, { data: USDAResult[]; at: number }>()
const CACHE_TTL = 10 * 60 * 1000

export async function GET(req: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ results: [] })

  const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '8'), 20)
  const cacheKey = `${q}:${pageSize}`

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
  url.searchParams.set('pageSize', String(pageSize))
  url.searchParams.set('nutrients', '203,204,205,208,291')

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 600 } })
    if (!res.ok) return NextResponse.json({ error: `USDA API error ${res.status}`, results: [] }, { status: 502 })

    const json = await res.json()
    const foods: USDAResult[] = (json.foods ?? []).map((food: Record<string, unknown>) => {
      const result: USDAResult = {
        fdcId: food.fdcId as number,
        name: (food.description as string) ?? '',
        kcalPer100g: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      }
      const nutrients = (food.foodNutrients ?? []) as Array<{ nutrientId: number; value: number }>
      for (const n of nutrients) {
        const field = NUTRIENT_MAP[n.nutrientId]
        if (field) result[field] = Math.round(n.value * 10) / 10
      }
      return result
    }).filter((r: USDAResult) => r.kcalPer100g > 0)

    cache.set(cacheKey, { data: foods, at: Date.now() })
    return NextResponse.json({ results: foods })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
