# Onboarding Wizard — Implementation Plan
*Status: AWAITING APPROVAL — do not implement until user approves*

---

## 0. Column Audit — What Already Exists on `profiles`

Derived from `ProfileClient.tsx` interface + migration history.

| User Spec Field | Column Name | Status |
|---|---|---|
| first_name | `first_name` | ✅ EXISTS |
| gender | `sex` | ✅ EXISTS (values: 'male'/'female' — same semantics, different name) |
| date_of_birth | `date_of_birth` | ❌ MISSING |
| height_cm | `height_cm` | ✅ EXISTS |
| weight_kg | `current_weight` | ✅ EXISTS (same data, different column name) |
| body_fat_pct | `body_fat_pct` | ✅ EXISTS |
| job_activity | `job_activity` | ❌ MISSING |
| daily_steps | `daily_steps` | ❌ MISSING |
| goal | `goal` | ✅ EXISTS |
| tdee_kcal | `tdee_kcal` | ❌ MISSING |
| daily_calories | `target_calories` | ✅ EXISTS |
| protein_g | `target_protein` | ✅ EXISTS |
| carbs_g | `target_carbs` | ✅ EXISTS |
| fat_g | `target_fat` | ✅ EXISTS |
| onboarding_completed | `onboarding_completed` | ❌ MISSING |

**5 columns to add. 9 reused. 0 renamed (mapping noted in code).**

Note on `age`: profiles has an `age` (numeric) column used by the profile screen.
The onboarding collects `date_of_birth` instead. On submit, derive age from DOB and
write both `date_of_birth` and `age` to keep the profile screen working.

---

## 1. Migration

**File:** `supabase/migrations/20260424_add_onboarding_columns.sql`

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth       date,
  ADD COLUMN IF NOT EXISTS job_activity        text,      -- 'desk' | 'feet' | 'labor'
  ADD COLUMN IF NOT EXISTS daily_steps         text,      -- 'lt5k' | '5-10k' | '10-15k' | 'gt15k'
  ADD COLUMN IF NOT EXISTS tdee_kcal           integer,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
```

Run via: `supabase db push` (or Supabase dashboard SQL editor).

---

## 2. Shared Routine Utility

**File:** `src/lib/createDefaultRoutines.ts` (NEW)

Extract `THREE_DAY_TEMPLATE` array and the insert loop from `TrainClient.tsx`
into a standalone async function:

```ts
export async function createDefaultRoutines(supabase: SupabaseClient, userId: string): Promise<void>
```

- Inserts Upper A, Upper B, Lower A into `routines` + `routine_exercises`
- Throws on error (CLAUDE.md rule #3)
- No state management — pure DB writes

**File:** `src/app/(app)/train/TrainClient.tsx` (MODIFY)
- Remove `THREE_DAY_TEMPLATE` constant and the insert loop from `loadTemplate`
- Import `createDefaultRoutines` and call it instead
- `loadTemplate` keeps its state management (`setLoadingTemplate`, `setRoutines`)

---

## 3. Route Architecture — Avoiding Redirect Loops

**Critical:** Onboarding goes at `src/app/onboarding/` — OUTSIDE the `(app)` route group.

Reason: `(app)/layout.tsx` adds `<BottomNav>` and will redirect non-onboarded users
to `/onboarding`. If onboarding were inside `(app)`, that redirect triggers for the
onboarding page itself → infinite loop.

By placing it outside `(app)`, the `(app)` layout never runs for `/onboarding`.
The onboarding page does its own auth check directly.

Two-sided guard:
- `(app)/layout.tsx` → if `!onboarding_completed` → `redirect('/onboarding')`
- `onboarding/page.tsx` → if `onboarding_completed` → `redirect('/dashboard')`

---

## 4. Files Touched — Full List

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260424_add_onboarding_columns.sql` | CREATE | Add 5 missing columns |
| `src/lib/createDefaultRoutines.ts` | CREATE | Shared routine creation utility |
| `src/app/(app)/train/TrainClient.tsx` | MODIFY | Import from shared utility |
| `src/app/(app)/layout.tsx` | MODIFY | Add onboarding_completed redirect |
| `src/app/onboarding/page.tsx` | CREATE | Server component — auth + onboarding guard |
| `src/app/onboarding/OnboardingClient.tsx` | CREATE | 5-step wizard UI + submit logic |

---

## 5. layout.tsx Changes

```ts
// After auth check:
const { data: profile } = await supabase
  .from('profiles')
  .select('onboarding_completed')
  .eq('id', user.id)
  .single()

if (!profile?.onboarding_completed) redirect('/onboarding')
```

BottomNav still renders — only authenticated, onboarded users reach it.

---

## 6. onboarding/page.tsx

Server component. Responsibilities:
1. `getUser()` → if no user → `redirect('/login')`
2. Query `profiles` for `onboarding_completed` → if true → `redirect('/dashboard')`
3. Pass `user.id` to `<OnboardingClient>`

---

## 7. OnboardingClient.tsx — State & Logic

### Form state (all in one `useState` object):
```ts
{
  firstName: '', gender: 'male', dob: '',
  heightCm: '', weightKg: '', bodyFatPct: 18,
  bodyFatMethod: 'visual',   // 'visual' | 'navy'
  neckCm: '', waistCm: '',   // navy inputs
  jobActivity: '',           // 'desk' | 'feet' | 'labor'
  dailySteps: '',            // 'lt5k' | '5-10k' | '10-15k' | 'gt15k'
  goal: '',                  // 'recomp' | 'cut' | 'bulk'
}
```

### Step progression:
- `step` state: 1–5
- Step 4 → 5 transition: compute TDEE + macros client-side before render
- Slide-in animation: CSS `transform: translateX` transition 0.35s ease

### TDEE calculation (client-side, runs on Step 4 → 5):
```
age = today.year - dob.year (adjusted for birthday)
BMR (male)   = 10×weight + 6.25×height − 5×age + 5
BMR (female) = 10×weight + 6.25×height − 5×age − 161
jobMult  = { desk: 1.2, feet: 1.375, labor: 1.55 }
stepMult = { lt5k: 0, '5-10k': 0.05, '10-15k': 0.1, gt15k: 0.175 }
TDEE = BMR × (jobMult + stepMult)
goalAdj = { recomp: 0, cut: −400, bulk: +250 }
calories = TDEE + goalAdj

protein  = round(weight × (cut?1.8 : 1.6))
fat      = round(weight × 0.8)
carbs    = max(0, round((calories − protein×4 − fat×9) / 4))
```

### Navy body fat formula (live-calculated on input change):
```
male:   495 / (1.0324 − 0.19077×log10(waist−neck) + 0.15456×log10(height)) − 450
female: 495 / (1.29579 − 0.35004×log10(waist+95−neck) + 0.22100×log10(height)) − 450
```
Result shown in green result card below inputs. If inputs are invalid (waist ≤ neck etc.)
show "—" instead of crashing.

### Step 5 — Reveal animations:
- TDEE and calories: `animateCount(0 → value, 1200ms)` on mount using `useEffect` + `requestAnimationFrame`
- Macros: staggered opacity fade-in after calories finish (protein 0ms, carbs 150ms, fat 300ms)
- Calendar: Mon/Wed/Fri cells transition to green after 1000ms delay

### On "I'm ready." button tap:
```
1. setSubmitting(true)
2. Upsert profiles row:
   {
     id: userId,
     first_name, sex (from gender), date_of_birth, age (derived),
     height_cm, current_weight (from weightKg), body_fat_pct,
     job_activity, daily_steps, goal,
     tdee_kcal, target_calories, target_protein, target_carbs, target_fat,
     onboarding_completed: true
   }
3. await createDefaultRoutines(supabase, userId)
4. router.push('/dashboard')
```
If upsert fails → throw (CLAUDE.md rule #3), show inline error, do not navigate.

---

## 8. Design Rules Checklist

- [ ] Pixel-match HTML mockup at 430px
- [ ] Inline styles only — zero Tailwind color classes
- [ ] SF Pro Display via `fontFamily` on outermost wrapper div
- [ ] Progress bar: thin green line with glowing dot at leading edge
- [ ] Step CTAs: Step 1 "Tell me more →" / Step 2 "Lock in my numbers →" / Step 3 "Set my activity →" / Step 4 "Set my goal →" / Step 5 "I'm ready."
- [ ] Slide transition: translateX, 0.35s ease, slides in from right
- [ ] No BottomNav (outside (app) group)
- [ ] Visual body fat tab: scrollable silhouette cards at 8/12/15/18/22/28/35% + linked slider
- [ ] Navy tab: live formula update on every keystroke
- [ ] Step 5: count-up animation for TDEE + calories, staggered macros, delayed calendar

---

## 9. Implementation Order

1. Write + apply migration
2. Create `createDefaultRoutines.ts`, refactor `TrainClient.tsx`
3. Modify `(app)/layout.tsx`
4. Create `onboarding/page.tsx`
5. Build `OnboardingClient.tsx` step by step (1 → 5)
6. Smoke test: new user flow, existing user not redirected, duplicate submit guard

---

*Awaiting approval to proceed.*
