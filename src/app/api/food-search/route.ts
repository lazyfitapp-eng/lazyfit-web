import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  detectFoodSearchIntent,
  getFoodSearchCandidatePageSize,
  normalizeUSDAFood,
  rankFoodSearchResults,
  type FoodSearchPayload,
  type USDAFood,
  type USDAResult,
} from '@/lib/foodSearchRelevance'

export type { USDAResult } from '@/lib/foodSearchRelevance'

// Simple in-memory cache. Key includes query, page size, source strategy, and rank version.
const cache = new Map<string, { data: FoodSearchPayload; at: number }>()
const CACHE_TTL = 10 * 60 * 1000

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ results: [] satisfies USDAResult[] })

  const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '8'), 20)
  const intent = detectFoodSearchIntent(q)
  const candidatePageSize = getFoodSearchCandidatePageSize(intent, pageSize)
  const cacheKey = `${q}:${pageSize}:${intent.sourceQuery}:${intent.dataTypeGroups.join('|')}:rank-v5`

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  const apiKey = process.env.USDA_API_KEY ?? 'DEMO_KEY'

  try {
    const groupedResults = await Promise.all(intent.dataTypeGroups.map(async (dataType, groupIndex) => {
      const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
      url.searchParams.set('query', intent.sourceQuery)
      url.searchParams.set('api_key', apiKey)
      url.searchParams.set('dataType', dataType)
      url.searchParams.set('pageSize', String(candidatePageSize))
      url.searchParams.set('nutrients', '203,204,205,208,291')

      const res = await fetch(url.toString(), { next: { revalidate: 600 } })
      if (!res.ok) return [] as ReturnType<typeof normalizeUSDAFood>[]

      const json = await res.json()
      return ((json.foods ?? []) as USDAFood[])
        .map((food, sourceIndex) => normalizeUSDAFood(food, (groupIndex * 1000) + sourceIndex))
    }))

    const candidates = groupedResults
      .flat()
      .filter(candidate => candidate.kcalPer100g > 0)

    const payload = rankFoodSearchResults(candidates, intent, pageSize)
    cache.set(cacheKey, { data: payload, at: Date.now() })
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ results: [] })
  }
}
