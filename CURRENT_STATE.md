# LazyFit — Current State Document
*Last updated: May 2026 — active state repaired for post-onboarding training hardening*

## ACTIVE STATE — MAY 2026

When this file conflicts with older sections below, the ACTIVE STATE section wins.

### Current Phase
Training hardening after Food Logger hardening.

### Latest Confirmed Commits
- `bf4b678` Fix workout recovery logged-set persistence
- `032d86b` Harden training partial-session rotation truth
- `f97d5ca` Polish training logging corrections and low-data copy
- `38c76c6` Polish Train program and workout day language
- `14ff132` Repair current state handoff doc for May training phase
- `8ddfbd8` Fix onboarding DOB validation state handling
- `23206db` Align default training routines with LazyFit doctrine
- `9fe1a76` Fix training progression guardrails
- `8d60bea` Polish food search loading and USDA result quality
- `7d03a9c` Polish food correction flows on mobile
- `37e3ecb` Add recent food repeat logging

### Food Status
Food Logger is good enough to pause for now.

It supports AI draft review, generated item scrolling, logged-food editing, recent foods, improved USDA ranking, search loading fix, negative macro sanitization, and mobile correction polish.

Deferred food work:
- Saved meals
- Barcode
- Deeper USDA preference/ranking
- Production-scale database improvements

### Training Status
Training is the current priority.

Confirmed:
- Workout recovery fixed and browser-validated.
- Partial-session rotation truth fixed.
- Training logging correction UX improved.
- Program / Workout Days language polished.
- Guardrails fixed.
- Default doctrine templates aligned.
- Fresh onboarding DOB blocker fixed.
- Fresh onboarding generated correct training days.

### Training Doctrine
LazyFit = Kinobody simplicity + Menno-style adaptive logic + Hevy-level execution + LazyFit nutrition engine.

LazyFit uses a 3-day upper-biased aesthetic program. The program contains workout days:
1. Upper A
2. Lower A
3. Upper B

These are not three unrelated routines.

### Current Generated Templates
Upper A:
- Incline Barbell Press
- Lat Pulldown
- Flat Dumbbell Press
- Cable Row
- Lateral Raise
- Tricep Pushdown

Lower A:
- Bulgarian Split Squat
- Hip Thrust
- Seated Leg Curl
- Leg Extension
- Calf Raise

Upper B:
- Overhead Press
- Pull-Up
- Machine Row
- Cable Lateral Raise
- Face Pull
- Bicep Curl

### Known Next Issue
Next sprint should be chosen by state check.

Current likely candidates:
- Coach card rebuild
- Lower B alternate architecture
- Steps/smart engine design
- Production QA

### Known Unresolved Future Architecture
Lower B / barbell lower should be an alternate lower-day variant, not a fourth default day.

### Workflow Rules
- One sprint at a time.
- Browser validation required for UI.
- Codex does not commit/push.
- Report before commit.
- Do not stage `docs/QA_FINDINGS.md` unless explicitly asked.
- No friends beta until Tudor explicitly asks.

---

## 1. The Idea — Philosophy & Inspiration

### Core Concept
LazyFit is a fitness tracking app built around a single, rebellious philosophy:

> *"Fitness is a lie. The industry is smoke and mirrors. LazyFit opens people's eyes and delivers the best possible results with minimal input — for busy people who hate training."*

This is not a calorie-obsessed fitness tracker. It's a **minimal effective dose** system. The premise: most people fail at fitness not because they lack information, but because every existing app overwhelms them with complexity, guilt, and noise. LazyFit cuts through all of it.

### The Promise to the User
- **3 gym sessions per week, 1 hour each** — no more
- Progressive overload that actually works for natural lifters
- Diet that doesn't require starving or sacrificing your social life
- The app does the thinking — the user just shows up

### Inspiration & Brand
- **Kinobody / Greg O'Gallagher** — primary alignment. Same target user (busy professionals), same philosophy (minimum effective volume, strength-first, aesthetic physique), same RPT (Reverse Pyramid Training) structure
- **Matrix** — the entire visual identity. Red pill / blue pill metaphor. "Take the red pill" = stop being fooled by the fitness industry. The UI is black and neon green (Matrix code rain), monospace fonts, terminal aesthetic
- **Hevy** — best-in-class workout UX. The training logging experience is modeled after Hevy's simplicity
- **Motto:** *"Whatever it takes. Success or death. We don't quit."*
- **Tagline:** *"Take the red pill."*

### Target User
- Busy professionals, executives, parents
- People who want a Greek God / aesthetic physique, not a bodybuilder physique
- People who've tried every app and burned out — they want something that respects their time
- Romanian market initially, English-first UI

### Training Philosophy (legacy notes; ACTIVE STATE wins)
- **RPT (Reverse Pyramid Training):** Heaviest set first (CNS freshest), back-off sets at -10% weight
- **Rep ranges now vary by movement:** current generated templates include 5–8, 8–12, 10–15, 12–15, and 15–20
- **Primary compounds:** 5–8 reps (near-maximal, 1 RIR — Reps in Reserve)
- **Secondary compounds:** commonly 8–12 or 10–15 reps
- **Isolations/machines:** commonly 10–15, 12–15, or 15–20 reps
- **Science basis:** 1 RIR = trivially less hypertrophy than failure (≤3%), dramatically better recovery. Allows consistent 3×/week training
- **Progressive overload engine:** see `src/lib/progressionConfig.ts` for current increments and bodyweight semantics

### Competitors (Researched)
| App | Relationship |
|-----|-------------|
| Kinobody / Kino Body | Philosophy twin — LazyFit is the app version of this |
| Hevy | Training UX inspiration |
| MyFitnessPal | What LazyFit replaces for food logging (simpler) |
| MacroFactor | Adaptive calorie algorithm inspiration |
| RP Strength (Israetel) | Consciously REJECTED — too much volume, too much fatigue for naturals |

---

## 2. Tech Stack

### Core
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js App Router | 16.2.1 |
| Language | TypeScript | ^5 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | v4 (PostCSS-first) |
| Database | Supabase (PostgreSQL) | ^2.101.1 |
| Auth | Supabase Auth (cookie-based SSR) | ^0.10.0 |
| AI Food | Anthropic Claude (Haiku) | ^0.82.0 |
| Components | shadcn/ui + base-ui/react | — |
| Icons | lucide-react | ^1.7.0 |

### Architecture Pattern
- **Server components** (`page.tsx`) fetch all data server-side, pass props to client components
- **Client components** (`*Client.tsx`) handle all interactivity, state, and mutations
- **API routes** (`/api/*`) handle AI calls and complex server-side logic
- **No Redux/Zustand** — local state only; Supabase as source of truth

### Key Libraries
- `class-variance-authority` — component variant system
- `clsx` + `tailwind-merge` — className merging (`cn()` utility)
- `@anthropic-ai/sdk` — Claude API for food recognition

### Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
ANTHROPIC_API_KEY          ← food AI feature
EXERCISEDB_API_KEY         ← exercise GIFs (RapidAPI, optional)
```

---

## 3. Design System

### Color Palette
All colors are CSS custom properties defined in `src/app/globals.css`. No separate constants file.

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` / `#00FF41` | Matrix green | Legacy — auth/landing pages only |
| `#3ecf8e` | Supabase green | Active accent in all rebuilt screens (CTAs, logged circles, active borders, progress fill) |
| `--background` / `#000000` | Pure black | App background |
| `#0a0a0a` | Near-black | Page background in rebuilt screens |
| `#141414` | Dark card | Lower-elevation card surfaces |
| `#1e1e1e` | Mid card | Mid-elevation cards, input backgrounds |
| `--secondary` / `#111111` | Dark gray | Input backgrounds (legacy) |
| `--muted-foreground` / `#555555` | Mid gray | Labels, secondary text |
| `#484848` | Dim label | Section headers, ghost labels in rebuilt screens |
| `--destructive` / `#FF0040` | Matrix red | Errors, destructive actions |
| `#FFAA00` | Amber | Warm-up sets, warnings, weekly check-in |
| `--border` / `#222222` | Dark border | Card/input borders |

**Muscle group chart colors** (in `src/lib/muscleMap.ts`):
Chest `#4a9eff` · Quads `#00FF41` · Back `#ff6b4a` · Shoulders `#FFAA00` · Arms `#cc44ff` · Hamstrings `#00CC33` · Calves `#888` · Glutes `#ff4a9e` · Core `#aaa`

### Typography
- **Font (auth/landing):** Geist Mono (Google Fonts, loaded via `next/font`) — Matrix terminal aesthetic
- **Font (rebuilt app screens):** `-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif` — applied via inline `fontFamily` on major containers in rebuilt components. Overrides Geist Mono from the root layout.
- **Label style:** `text-xs tracking-widest font-mono` — legacy pattern; rebuilt screens use inline `fontSize`/`letterSpacing`

### Component Patterns
```
Card:     bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4
Input:    bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-white focus:border-primary
Button:   bg-primary text-black font-bold rounded-lg (primary)
          border border-[#333] text-[#888] rounded-lg (secondary)
Label:    text-[10px] tracking-widest text-[#555] font-mono uppercase
Modal:    fixed inset-0 z-50 bg-black/90 backdrop-blur-sm
```

> **CRITICAL — Color styling rule (rebuilt screens):** All color values must use inline `style` props, NOT Tailwind color classes. Reason: `@layer base { * { @apply border-border outline-ring/50 } }` in `globals.css` causes Tailwind to auto-inject `--ring` glow on focus for any element using Tailwind's border/color utilities. Inline styles bypass this entirely. This applies to all backgrounds, borders, text colors, and shadows in rebuilt components (`DashboardClient`, `TrainClient`, `WorkoutHistory`, `ActiveWorkoutClient`).

### Special Visual Elements
- **Matrix Rain** (`MatrixRain.tsx`) — canvas animation on auth/landing pages, fitness-themed character pool
- **Warm-up sets:** amber `#FFAA00` labels (W1/W2/W3), distinct from working sets (green)
- **Active nav items:** green glow + `bg-[#001a0d]` background
- **PR badges:** green pill on exercise name in summary

---

## 4. Screen Map

### Route Groups
```
(marketing)/    ← no auth required
(auth)/         ← no auth required
(app)/          ← protected, requires auth, has BottomNav
```

---

### SCREEN 1 — Landing Page
**Route:** `/`
**File:** `src/app/(marketing)/page.tsx`
**Type:** Server component (static)

**What it shows:**
- MatrixRain animated background (canvas)
- Hero: "TAKE THE RED PILL" headline + subtext
- 4 feature cards: Adaptive Progression, Macro Tracking, Smart Weight Tracking, Zero Bloat
- CTA buttons → /signup and /login
- Matrix aesthetic: green on black, monospace

**Status:** ✅ Working

---

### SCREEN 2 — Login
**Route:** `/login`
**File:** `src/app/(auth)/login/page.tsx`
**Type:** Client component

**What it shows:**
- Email + password form
- Google OAuth button
- MatrixRain background
- Error messages
- Link to /signup

**Status:** ✅ Working

---

### SCREEN 3 — Signup
**Route:** `/signup`
**File:** `src/app/(auth)/signup/page.tsx`
**Type:** Client component

**What it shows:**
- Email + password form
- Google OAuth button
- Post-submit: "Check your email" confirmation screen
- Link to /login

**Status:** ✅ Working

---

### SCREEN 4 — Reset Password
**Route:** `/reset-password`
**File:** `src/app/(auth)/reset-password/page.tsx`
**Type:** Client component

**What it shows:**
- New password + confirm password inputs
- Validates match + min 6 chars
- Redirects to /dashboard on success

**Status:** ✅ Working

---

### SCREEN 5 — Dashboard (Home)
**Route:** `/dashboard`
**Files:** `src/app/(app)/dashboard/page.tsx` → `DashboardClient.tsx`
**Type:** Server page + Client component

**What it shows:**
- **Weigh-in card** — latest weight, 7-day EMA trend, weekly delta, "LOG WEIGHT" button
- **Calorie ring** — circular SVG chart: consumed vs target
- **Macro bars** — protein / carbs / fat progress bars
- **14-day activity strip** (WeekStrip) — green dots for food logged, workout done
- **Weekly check-in banner** — prompts weekly progress review (if due)
- **Meal sections** — today's food grouped by breakfast/lunch/dinner/snack
- **Progress charts** — 90-day weight trend + 30-day calorie intake
- **Workout summary** — days since last, this week count

**Data fetched (server):**
- User profile (macro targets)
- Today's food logs
- Last 7 days weight entries
- 90-day weight chart + 30-day food chart
- Last 14 days workouts

**Status:** ✅ Working. Date picker lets user view past days.
**Redesigned:** `pct()` helper prevents NaN% in SummaryCard macros; macro bars rebuilt with inline styles; WeighInCard spacing fixed; WeekStrip timezone fix (suppresses today dot when no data logged yet for the current day).

---

### SCREEN 6 — Food Logging
**Route:** `/food`
**Files:** `src/app/(app)/food/page.tsx` → `FoodClient.tsx`
**Type:** Server page + Client component

**What it shows:**
- Calorie ring + macro bars (same as dashboard)
- Foods logged today, grouped by meal type (breakfast/lunch/dinner/snack)
- "+" button → opens FoodAIModal
- Each food entry: name, calories, macros, delete button
- Date selector to log for other days

**How food AI works:**
1. User opens FoodAIModal → picks meal type
2. Takes photo OR types description
3. Sent to `/api/food-ai` → Claude Haiku analyzes
4. Returns list of foods with estimated macros
5. User edits/confirms → logged to `food_logs` table

**Status:** ✅ Working. AI food recognition functional.

---

### SCREEN 7 — Training Overview
**Route:** `/train`
**Files:** `src/app/(app)/train/page.tsx` → `TrainClient.tsx` + `WorkoutHistory.tsx`
**Type:** Server page + Client component

**What it shows:**

**PROGRAM tab / Program surface:**
- "START EMPTY WORKOUT" button
- LazyFit 3-Day Aesthetic shown as one program with Workout Days: Upper A / Lower A / Upper B
- "LOAD TEMPLATE" button → creates the 3 workout days for the program
- Last workout card (duration, volume, muscle split, date)
- `is_system` boolean on routines remains internal — system workout days cannot be deleted; custom routines show a trash icon
- Muscle color in workout-day card overridden by rank (primary muscle = full accent, secondary = dimmed)
- "How to" pill button visible inline next to each exercise name (not hidden in `···` menu)

**HISTORY tab** (`WorkoutHistory.tsx` — fully rebuilt with inline styles):
- Monthly calendar with green dots on workout days (all inline styles — no Tailwind colors)
- ← → month navigation
- Header shows "N workouts this month" count
- List of `WorkoutCard` components: 3-part flex layout with left accent bar (`#3ecf8e`)
- `getBestSet()` filters `set_type === 'working'` only — warm-up sets excluded from best set display
- `deriveWorkoutName()` generates readable name from exercise list when no routine name exists
- Tap card → navigates to /train/summary/[workoutId]

**Current Generated Template (LazyFit doctrine):**

*Upper A:* Incline Barbell Press, Lat Pulldown, Flat Dumbbell Press, Cable Row, Lateral Raise, Tricep Pushdown

*Lower A:* Bulgarian Split Squat, Hip Thrust, Seated Leg Curl, Leg Extension, Calf Raise

*Upper B:* Overhead Press, Pull-Up, Machine Row, Cable Lateral Raise, Face Pull, Bicep Curl

**Status:** ✅ Working.

---

### SCREEN 8 — Active Workout
**Route:** `/train/[workoutId]`
**Files:** `src/app/(app)/train/[workoutId]/page.tsx` → `ActiveWorkoutClient.tsx`
**Type:** Server page + Client component

**What it shows (`ActiveWorkoutClient.tsx` — fully rebuilt with inline styles):**

**Sticky header:**
- Routine name + elapsed timer + "X/Y working sets" progress label
- Progress bar: `#2a2a2a` track, `#3ecf8e` inline fill, width = `(totalLogged/totalSets)*100%`
- FINISH button: `background: '#3ecf8e', color: '#000'` (solid green)

**Per-exercise blocks:**
- `overflow: hidden` removed — required for active row negative margin to render correctly
- Exercise header: name + "How to" pill button visible inline (no longer hidden in `···` menu)
- **WARM-UP section** (amber `#FFAA00`) — header with `#2a1f00` divider line; ghost column shows `—`
  - Auto-generated W1/W2/W3 sets; delete button per set; "+ ADD WARM-UP SET"
  - Collapses to "✓ WARM-UP COMPLETE" amber chip after all logged
- **Coach card:** bg `#0d1f17`, border `1px solid #1a3528`; label "COACH — TODAY"; horizontal target pills (max 3 shown + "+N more"); "Keep same" button renders only when `coachStatus === 'up'`
- **WORKING SETS** — 6-column CSS grid `20px 36px 1fr 68px 68px 44px`
  - Active row highlight: `background: '#0d1a12', borderLeft: '3px solid #3ecf8e', margin: '3px -12px 5px'`
  - Active set type badge: `color: '#3ecf8e', background: '#0d2118'` (green on dark teal)
  - Log circles: 40px — logged = solid `#3ecf8e`, active = `2.5px solid #3ecf8e`, pending = `2px solid #1e1e1e`
  - Weight + reps inputs pre-filled from progression engine

**Session bar (new — fixed bottom):**
- `position: fixed, bottom: 0, zIndex: 50` — overlays BottomNav (`z-40`)
- Shows: Elapsed | Sets done (value in `#3ecf8e`) | Remaining | Pause button
- `paddingBottom: 'env(safe-area-inset-bottom, 20px)'` for iPhone notch
- Scrollable body uses `paddingBottom: '160px'` to clear session bar

**Finish Workout button:** ghost style — `background: 'none', border: '1px solid #222', color: '#484848'`

**Rest timer overlay** — full screen countdown with green progress bar, boxing bell sound when done

**BottomNav:** hidden on all `/train/` subroutes via `pathname.startsWith('/train/')` in `BottomNav.tsx`

**"+ ADD EXERCISE"** button → search modal

**Warm-up science basis (Kraemer & Ratamess 2004):**
- <30kg working weight → no warm-up
- 30–60kg → 2 sets (50%×8, 70%×3)
- 60–100kg → 3 sets (40%×8, 60%×5, 80%×2)
- 100–140kg → 3 sets (40%×6, 60%×4, 80%×2)
- 140kg+ → 4 sets (35%×6, 50%×4, 70%×3, 85%×1)
- Last warm-up always 150s rest (PAP window)

**Progression engine:**
- On workout finish → for each exercise, reads working sets only (warm-ups filtered out)
- If all sets hit reps_max → next session: +2.5kg (compound) or +1kg (isolation)
- Targets stored in `exercise_targets` table (user_id, exercise_name, set_number)

**How To modal:**
- Fetches from `/api/exercise-media` → ExerciseDB API
- Shows: exercise GIF (if API has one) OR YouTube search card
- Shows: step-by-step written instructions, target muscle, secondary muscles
- Currently: GIF API returns null (free tier limitation) → shows YouTube card

**Status:** ✅ Functional. Rest timer has boxing bell sound. Warm-ups auto-generate. Progression engine works. UI fully rebuilt.
Workout recovery is browser-validated. Active workout hydrates DB-persisted `workout_sets`; DB logged sets remain the source of truth through `/train` resume and active-route refresh; localStorage only restores unsaved draft inputs.
Readability fixes complete — all text colors updated, font sizes increased throughout (column headers, set labels, inputs, buttons). Completed warmup rows (W2, W3) display reps as plain `<div>` elements (not disabled inputs) to avoid browser UA dimming.
⚠️ Exercise GIFs not showing (ExerciseDB paid tier required — plan: shoot own YouTube demos)

---

### SCREEN 9 — Workout Summary
**Route:** `/train/summary/[workoutId]`
**Files:** `src/app/(app)/train/summary/[workoutId]/page.tsx` → `SummaryClient.tsx`
**Type:** Server page + Client component

**What it shows:**
- Sticky header: back button, workout name + date, "✓ DONE" chip (if today's workout)
- Per-exercise breakdown:
  - Warm-up rows (amber W1/W2 labels, dimmed)
  - Working sets table: SET / WEIGHT / REPS / 1RM columns
  - Best set highlighted white
  - PR badge if new personal record
- Muscle split bar (colored by muscle group)
- Coaching panel: "NEXT SESSION" targets per set
- "DONE →" button (if today) or "← BACK" button (past workouts)
- "Save as Routine" button (today only, if no routine attached)

**1RM formula:** Epley: `weight × (1 + reps / 30)`

**Status:** ✅ Working.

---

### SCREEN 10 — Exercise History
**Route:** `/train/exercise/[name]`
**Files:** `src/app/(app)/train/exercise/[name]/page.tsx` → `ExerciseHistoryClient.tsx`
**Type:** Server page + Client component

**What it shows:**
- Exercise name header
- Metric tabs: Est. 1RM | Best Weight | Set Volume
- Time range filter: 30D | 90D | 1Y | ALL
- Custom SVG line chart showing progression
- Session list with per-set breakdown
- Expandable "HOW TO" section (same media modal as active workout)

**Status:** ✅ Working.

---

### SCREEN 11 — Progress
**Route:** `/progress`
**Files:** `src/app/(app)/progress/page.tsx` → `ProgressClient.tsx`
**Type:** Server page + Client component

**What it shows:**

**Weight tab:**
- Line chart: actual daily weight (gray) + EMA trend line (green)
- Time range selector: Week / Month / Quarter / Year / All
- Current weight, goal weight, weekly change stats

**Nutrition tab:**
- Daily calorie bar chart (30 days)
- Target calorie line overlay
- Average calorie adherence stats

**Trend weight algorithm:** 7-day exponential moving average. Smooths out water weight, hormonal fluctuations, glycogen. Shows "true" fat loss/gain trend.

**Status:** ✅ Working.

---

### SCREEN 12 — Profile
**Route:** `/profile`
**Files:** `src/app/(app)/profile/page.tsx` → `ProfileClient.tsx`
**Type:** Server page + Client component

**What it shows:**
- **Identity header** — first_name + last_name (falls back to email); Founding Member badge (amber `#f5a623`) for beta users
- **Goal selector** — 3 cards: Cut / Recomp / Lean Bulk; tap → confirm modal with macro diff table + coach-voice quote; animated kcal count-up on switch
- **Nutrition card** — goal-colored background; large kcal; confidence bar; protein/carbs/fat grid
- **Training days stepper** — −/number/+ (1–7)
- **Units toggle** — kg / lbs segmented control; stored in `preferred_units`
- **Body section** — tappable rows for Age, Sex, Height; each opens bottom edit drawer; Activity level row with 5-segment bar; Body fat row (US Navy method — shows "+ Log neck" CTA until neck_cm logged)
- **Account section** — Privacy Policy link; Sign out; Delete account (confirm modal → hard delete all user data)

**Macro calculation:** Mifflin-St Jeor BMR × activity multiplier (sedentary 1.2 → athlete 1.9). Cut −400 kcal / Recomp maintenance / Lean Bulk +250 kcal.

**DB columns added:** `first_name`, `last_name`, `preferred_units` (text, default 'kg'), `body_fat_pct` (numeric), `neck_cm` (numeric). `activity_level` (text: sedentary/light/moderate/very_active/athlete) already existed.

**Status:** ✅ Complete. All sections interactive. Goal switching with macro recalculation works. Edit drawers + activity sheet working. Delete account working.

---

## 5. Component Structure

### Navigation
```
src/components/BottomNav.tsx        ← Fixed mobile nav bar (fully rebuilt — inline styles only)
  Tabs: Home (/dashboard) · Food (/food) · FAB (center) · Train (/train) · Progress (/progress)
  Active state: color #3ecf8e, fontWeight 600, opacity 1
  Inactive state: color #888888, opacity 0.6
  FAB: background #3ecf8e, borderRadius 50%, 48×48px, marginTop -20px, border 3px solid #090909
  FAB behavior: dispatches lazyfit:open-food-modal on /food; navigates to /train otherwise
  Hidden on all /train/ subroutes (active workout)
  Zero Tailwind color classes — all inline styles
```

### Shared Components
```
src/components/
├── BottomNav.tsx              ← Mobile nav (all app screens)
├── MatrixRain.tsx             ← Canvas animation (auth + landing)
├── WeekStrip.tsx              ← 14-day activity calendar dots
├── DashboardDatePicker.tsx    ← Date selector for dashboard/food
├── WeeklyCheckinWrapper.tsx   ← Weekly review trigger (localStorage)
├── WeeklyCheckin.tsx          ← Weekly progress review modal
├── WeighInModal.tsx           ← Weight logging modal
├── FoodAIModal.tsx            ← AI food recognition modal
├── SurveyModal.tsx            ← Feedback survey modal
└── ui/button.tsx              ← shadcn Button with CVA variants
```

### Screen-Level Client Components
```
src/app/(app)/
├── dashboard/DashboardClient.tsx
├── food/FoodClient.tsx
├── train/
│   ├── TrainClient.tsx
│   ├── WorkoutHistory.tsx
│   ├── [workoutId]/ActiveWorkoutClient.tsx
│   ├── summary/[workoutId]/SummaryClient.tsx
│   └── exercise/[name]/ExerciseHistoryClient.tsx
└── progress/ProgressClient.tsx
```

### API Routes
```
src/app/api/
├── exercise-media/route.ts    ← GET: exercise GIF + instructions (ExerciseDB)
├── exercise-targets/route.ts  ← GET: per-set progression targets for user
├── food-ai/route.ts           ← POST: Claude Haiku food analysis
└── auth/callback/route.ts     ← GET: OAuth redirect handler
```

### Utility Libraries
```
src/lib/
├── supabase/client.ts         ← Browser Supabase client
├── supabase/server.ts         ← Server Supabase client (cookie-based)
├── muscleMap.ts               ← Exercise → muscle group + color mapping
├── warmup.ts                  ← Science-based warm-up set generator
├── trendWeight.ts             ← 7-day EMA weight trend calculator
├── tdeeCalculator.ts          ← Mifflin-St Jeor BMR + TDEE + macro targets
└── utils.ts                   ← cn() classname merger
```

---

## 6. Database Schema (Supabase)

### Tables in Use
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `auth.users` | Supabase auth | id, email |
| `profiles` | User settings | id, target_calories, target_protein, target_carbs, target_fat, current_weight, height_cm, age, sex, goal, subscription_status |
| `food_logs` | Daily nutrition | user_id, food_id, food_name, calories, protein, carbs, fat, quantity, meal_type, logged_at |
| `weight_entries` | Daily weigh-ins | user_id, weight, date (unique per user+date) |
| `workouts` | Workout sessions | id, user_id, routine_id, completed_at, duration_minutes |
| `workout_sets` | Logged sets | workout_id, exercise_name, set_number, weight_kg, reps_completed, set_type ('warmup'/'working'/null) |
| `routines` | Saved programs | id, user_id, name |
| `routine_exercises` | Exercises per routine | routine_id, exercise_name, sets_target, reps_min, reps_max, rest_seconds, exercise_order |
| `exercise_targets` | Progression targets | user_id, exercise_name, set_number → PK, target_weight_kg, reps_min, reps_max |
| `exercise_media` | GIF/instructions cache | exercise_name, gif_url, instructions, target_muscle, secondary_muscles |

### RLS Status
- All tables have RLS enabled
- All policies: `auth.uid() = user_id` (profiles: `auth.uid() = id`)
- `exercise_media`: RLS **disabled** (public cache table, no user data)

---

## 7. What's Working ✅

| Feature | Notes |
|---------|-------|
| Full auth flow | Login, signup, Google OAuth, password reset |
| Food AI logging | Claude Haiku, image + text, macro estimation |
| Dashboard | Real data, date picker, calorie ring, macro bars, weight trend |
| Weight tracking | EMA trend, weigh-in modal, 90-day chart |
| Training — program/workout days | Create/load program template, start workout |
| Training — active workout | Sets, reps, warm-ups, rest timer, boxing bell |
| Training — workout recovery | Recovery banner works; DB-logged sets persist through resume/refresh; localStorage remains draft-input safety net |
| Training — progression engine | +2.5kg/+1kg when all reps hit max |
| Training — warm-up sets | Auto-generated, science-based, editable |
| Workout history | Calendar view, workout cards, muscle split |
| Workout summary | Full exercise log, PR badges, coaching targets |
| Exercise history | 1RM chart, best weight, volume trends |
| Progress charts | Weight trend (EMA), calorie adherence |
| How To modal | Written instructions + muscle info (GIFs pending) |
| Progress screen | Full rebuild complete ✅ |
| Profile screen | Fully interactive — goal switching, macro calc, edit drawers, activity sheet ✅ |

---

## 8. What's Broken / Placeholder ⚠️

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| Exercise GIFs not showing | `/api/exercise-media` | Medium — How To shows YouTube card instead | Shoot own videos for LazyFit YouTube channel (best long-term), OR pay $10 one-time ExerciseDB |
| Coach card rebuild | `ActiveWorkoutClient.tsx` | Medium — currently shows redundant set info; ↑/→ Hold badge triggers lack clear rules | Rewrite progression logic with explicit scientific rules; clean up coach card UI |
| Lower B alternate architecture | Training templates / routine model | Medium — barbell lower should be an alternate lower-day variant, not a fourth default day | Design alternate lower-day variant without changing the default 3-day program |
| Onboarding flow | `/onboarding` | Fixed blocker — fresh onboarding completed and generated correct training days | Keep browser-validating fresh onboarding after training changes |
| Weekly check-in | `WeeklyCheckin.tsx` | Medium — UI exists, adaptive calorie loop not wired | Connect to `suggestCalorieTarget()` in `trendWeight.ts` |
| Subscription / paywall | `profiles.subscription_status` | High for monetization — field exists, no enforcement | Build paywall + Stripe/payment integration |
| Food follow-ups | `FoodClient.tsx` | Deferred — Food Logger is good enough to pause | Saved meals, barcode, deeper USDA ranking, production-scale database improvements |
| Rate limiting on API routes | All `/api/*` routes | Low now, high at scale | Add rate limiting middleware |

---

## 9. File Structure (Abbreviated)

```
lazyfit-web/
├── src/
│   ├── app/
│   │   ├── (marketing)/page.tsx          ← Landing /
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx            ← /login
│   │   │   ├── signup/page.tsx           ← /signup
│   │   │   └── reset-password/page.tsx   ← /reset-password
│   │   ├── (app)/
│   │   │   ├── layout.tsx                ← Auth gate + BottomNav
│   │   │   ├── dashboard/                ← /dashboard
│   │   │   ├── food/                     ← /food
│   │   │   ├── train/                    ← /train + /train/[id] + /train/summary/[id] + /train/exercise/[name]
│   │   │   ├── progress/                 ← /progress
│   │   │   └── profile/                  ← /profile
│   │   ├── api/
│   │   │   ├── exercise-media/route.ts
│   │   │   ├── exercise-targets/route.ts
│   │   │   └── food-ai/route.ts
│   │   ├── globals.css                   ← All CSS vars + base styles
│   │   └── layout.tsx                    ← Root layout (Geist Mono font)
│   ├── components/                       ← Shared UI components
│   └── lib/                              ← Utilities (supabase, warmup, trendWeight, etc.)
├── CURRENT_STATE.md                      ← This document
└── .env.local                            ← Secrets (not in git)
```

---

## 10. Key Decisions & Constraints

| Decision | Reason |
|----------|--------|
| Next.js App Router (not Pages Router) | Modern SSR pattern, server components for data fetching |
| Server component fetches → client component renders | Clean separation, no loading states for initial data |
| No Redux/Zustand | Overkill for current state needs; Supabase is source of truth |
| Tailwind v4 (PostCSS-first) | No config file — all customization via CSS variables |
| Monospace font everywhere | Matrix aesthetic — auth/landing only; rebuilt app screens use SF Pro Display |
| Legacy routine data model remains internally; user-facing Train UI now frames system as Program / Workout Days | Data model still uses `routines`, but visible copy treats LazyFit as one program with workout days |
| set_type column ('warmup'/'working') | Prevents warm-up sets from corrupting progression engine |
| exercise_targets PK on (user_id, exercise_name, set_number) | Enables upsert for per-set progression tracking |
| RLS disabled on exercise_media | Public cache table, no user data — simplifies server writes |
| Inline styles for all colors | Tailwind's `@layer base` auto-injects `outline-ring/50` glow; inline styles bypass this |

---

## 11. Design Handoff — HTML Reference Files

Static HTML mockups used as pixel-perfect design references for rebuilt screens. Located on the desktop.

| File | Screen | Status |
|------|--------|--------|
| `C:\Users\Jarvis\Desktop\lazyfit_dashboard.html` | Dashboard | Implemented ✅ |
| `C:\Users\Jarvis\Desktop\lazyfit_train.html` | Train / Program tab | Implemented ✅ |
| `C:\Users\Jarvis\Desktop\lazyfit_history.html` | Train / History tab | Implemented ✅ |
| `C:\Users\Jarvis\Desktop\lazyfit_active_workout_final.html` | Active Workout | Implemented ✅ |
| `lazyfit_exercise_history.html` | Exercise History | Implemented ✅ |
| `lazyfit_progress.html` | Progress | Implemented ✅ |
| `lazyfit_profile.html` | Profile | Implemented ✅ |

These files define the exact colors, spacing, grid layout, and component patterns used in the rebuilt screens. When making future UI changes to these screens, treat these HTML files as the source of truth for visual intent.

---

## 12. Global Contrast & Readability Pass (April 2026)

A systematic multi-round pass was applied across all components to fix unreadable text on dark backgrounds. All hardcoded dark hex values were replaced with the current floor values:

| Old value | Replaced with | Role |
|-----------|--------------|------|
| `#444`, `#484848`, `#555`, `#383838` | `#b8b8b8` | Secondary text, labels |
| `#333`, `#3a3a3a`, `#2e2e2e`, `#666` | `#888888` | Dim text, separators |
| `#2a2a2a` (text only) | `#888888` | Ghost text — backgrounds/borders left untouched |

**Files updated:** `DashboardClient.tsx`, `FoodClient.tsx`, `FoodAIModal.tsx`, `ProgressClient.tsx`, `ActiveWorkoutClient.tsx`, `WorkoutHistory.tsx`, `TrainClient.tsx`, `ExerciseHistoryClient.tsx`, `ExerciseProgressChart.tsx`, `WeeklyCheckin.tsx`, `WeighInModal.tsx`, `SurveyModal.tsx`, `ProfileClient.tsx`, auth pages, `muscleMap.ts`.

**Additional size/readability fixes in `ActiveWorkoutClient.tsx`:** Column headers, set labels, input font sizes, button sizes all increased. Completed warmup reps now render as plain `<div>` elements (not disabled inputs) to bypass browser UA color overrides.

**Color floor going forward:**
- Secondary text minimum: `#b8b8b8`
- Dim/ghost text minimum: `#888888`
- Never use values below `#888888` for any readable text

---

## 13. Backlog — Post-MVP

| Item | Priority | Notes |
|------|----------|-------|
| Coach card rebuild | 🟡 Medium | Clear ↑/→ Hold rules; remove redundant set display |
| Lower B alternate architecture | 🟡 Medium | Lower B / barbell lower should be an alternate lower-day variant, not a fourth default day |
| Onboarding regression checks | 🟡 Medium | Fresh onboarding should continue to validate DOB and generate Upper A / Lower A / Upper B |
| Steps / smart engine design | 🟢 Post-launch | Decide how steps, adherence signals, and adaptive coaching should feed the engine |
| Adaptive TDEE algorithm | 🟢 Post-launch | MacroFactor-style: logged weight + food → reverse-engineer real TDEE |
| AI Coach chat tab | 🟢 Post-launch | Separate tab, rule-based at launch |
| Waist logging | 🟢 Post-launch | Required for US Navy body fat method in profile |
| Backdated weight entry | 🟢 Post-launch | Let users log past weigh-ins |
| Food follow-ups | 🟢 Post-launch | Saved meals, barcode, deeper USDA ranking, production-scale database improvements |
| Paywall / Stripe | 🔴 High (post-beta) | subscription_status field exists; no enforcement yet |
