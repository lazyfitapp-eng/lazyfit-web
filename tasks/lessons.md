# LazyFit Web — Lessons Learned

## Anthropic SDK

### Init client inside the handler, not at module level
```ts
// ❌ env var not available at module init time in Next.js
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ✅ init inside POST handler
export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set in .env.local' }, { status: 500 })
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}
```

### Surface actual error messages — never generic fallbacks
Generic "AI request failed" hides the real problem (e.g. "Your credit balance is too low").

## Supabase

### food_logs requires food_id — generate for AI-logged items
`food_id: \`ai-${Date.now()}-${Math.random().toString(36).slice(2)}\``

### Confirm DB success before optimistic UI update on deletes
```ts
const { error } = await supabase.from('food_logs').delete().eq('id', id)
if (error) { alert(`Delete failed: ${error.message}`) }
else { setLogs(prev => prev.filter(l => l.id !== id)) }
```

## Next.js

### Clear .next after deleting route folders
`rm -rf .next` fixes TypeScript errors from stale validator.ts referencing deleted pages.

### Restart dev server after .next is cleared
Internal Server Error on localhost = stale dev server. Ctrl+C + `npm run dev`.

## Architecture

### Server component fetches → client component renders
All page-load queries in `page.tsx` (async server component). `*Client.tsx` = 'use client', receives typed props, handles all interactivity and mutations.

### Training: routines replace programs in UI
The `programs`/`program_days`/`program_exercises` DB tables exist but are NOT used in the UI.
All workout UI uses `routines` + `routine_exercises`. Deleted: `/train/new/`, `/train/customize/`, `StartWorkoutButton.tsx`.

### Workout UX: model on Hevy, not MH Physique
MH Physique app has poor workout UX. Hevy is best-in-class. Training methodology (RPT, progression) from Menno's published science, workout UX from Hevy.
