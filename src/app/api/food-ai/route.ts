import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export interface FoodAIItem {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  quantity_g: number
  confidence: 'high' | 'medium' | 'low'
  assumption?: string
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set in .env.local' }, { status: 500 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Auth check via cookie session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { image, text, meal_type } = body as {
    image?: string   // base64 data URL
    text?: string
    meal_type?: string
  }

  if (!image && !text) {
    return NextResponse.json({ error: 'Provide image or text' }, { status: 400 })
  }

  const systemPrompt = `You are a careful nutrition expert. Analyze the food shown/described and return ONLY a valid JSON array.
Each element must have: name (string), calories (number, kcal), protein (number, g), carbs (number, g), fat (number, g), quantity_g (number), confidence ("high"|"medium"|"low"). You may include assumption (string) when relevant.
Do not invent oil, butter, sauce, dressing, mayo, cream, or ghee quantities. If the user mentions one of these without a quantity, do not add hidden calories for it; set confidence to "low" and mention the missing quantity in assumption.
When added oils or sauces have a quantity, separate them as their own food items.
If the user says "cooked chicken breast" with grams, treat the grams as cooked weight.
If raw/cooked/dry/boiled state is unclear for rice, pasta, meat, fish, or potato, use the most reasonable assumption, set confidence to "medium" or "low", and mention the assumption.
Estimate realistic portions only when the user has not provided quantity. If multiple foods are visible, return one entry per distinct food item.
Return ONLY the JSON array, no markdown, no explanation.`

  const userText = [
    text ? `The user describes: "${text}"` : null,
    meal_type ? `This is for ${meal_type}.` : null,
    'Analyze and return the JSON array of food items with estimated macros.',
  ].filter(Boolean).join(' ')

  const content: Anthropic.MessageParam['content'] = []

  if (image) {
    // Strip data URL prefix to get raw base64 + media_type
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/)
    if (match) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: match[2],
        },
      })
    }
  }

  content.push({ type: 'text', text: userText })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    let items: FoodAIItem[]
    try {
      items = JSON.parse(cleaned)
      if (!Array.isArray(items)) throw new Error('Not an array')
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 500 })
    }

    return NextResponse.json({ items })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[food-ai]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
