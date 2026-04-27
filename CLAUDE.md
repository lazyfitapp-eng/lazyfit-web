# LazyFit Web

Next.js App Router + Supabase + Tailwind v4 fitness app. Matrix dark theme (#000000, #00FF41). TypeScript. Romanian market.

## Status
Sprints 1–11 complete. See `CURRENT_STATE.md` for full screen map, what works, and what's pending.

## Rules
1. Plan mode for any task 3+ steps — write plan to `tasks/todo.md` first, check in before implementing
2. After any correction → update `tasks/lessons.md` with the pattern
3. DB write functions must throw on error — never silently return null
4. Colors: CSS custom properties only (`--primary`, `bg-[#0d0d0d]`, etc.) — never hardcode hex values outside globals.css
5. DB columns: snake_case. JS/TS variables: camelCase
6. RLS on all tables: `auth.uid() = user_id` (profiles: `id`). Exception: `exercise_media` has RLS disabled (public cache)
7. Server components (`page.tsx`) fetch data → pass props to client components (`*Client.tsx`) for UI
8. Use subagents to keep main context clean — one focused task per subagent
9. Never mark a task done without proving it works
10. Never use git worktrees. All work happens directly on the main branch in the primary working directory `C:\Users\Jarvis\Desktop\lazyfit-web`

## Working Directory Rules
- Never use git worktrees. All work happens directly on the main branch in the primary working directory `C:\Users\Jarvis\Desktop\lazyfit-web`.
- The shell CWD resets to `C:\Users\Jarvis\Desktop\lazyfit` after every bash tool call. Prepend `cd /c/Users/Jarvis/Desktop/lazyfit-web &&` to every bash command in every session. File read/edit tools require absolute paths to `C:\Users\Jarvis\Desktop\lazyfit-web\...`.

## Key References
- Full app context, philosophy, screens, design system: `CURRENT_STATE.md`
- Coding gotchas and learned patterns: `tasks/lessons.md`
- Active plan: `C:\Users\Jarvis\.claude\plans\lazy-mapping-mitten.md`

## When to Read Detailed Docs
- Starting any task → read `tasks/lessons.md` for prior gotchas
- Touching training/workout logic → understand `set_type` ('warmup'/'working'/null) in `workout_sets`
- Touching Supabase writes → confirm RLS policy exists for that table
- Touching exercise media → read `feedback_exercise_media.md` in memory (ExerciseDB free tier limitation)
- Need full screen or component context → read `CURRENT_STATE.md`

## Critical Supabase Config (already applied, do not re-run)
- `exercise_targets` PK on `(user_id, exercise_name, set_number)` — enables progression upsert
- `exercise_media` RLS disabled — public cache, needed for server writes

---

## Design Prompting Framework

This section defines how to prompt Claude (claude.ai chat) when designing 
new screens or components for LazyFit. Follow this framework every time to 
guarantee the highest possible design output quality.

---

### The Core Principle
Claude's output quality is directly proportional to the pressure applied. 
Never accept version 1. Never accept "good enough." The best work comes 
from refusing every answer until Claude finds its own flaws and fixes them 
unprompted.

---

### Step 1 — Context Dump
Before any design work, provide:
- The CURRENT_STATE.md file
- Screenshots of the existing screen (if it exists)
- The screen's route, file location, and data it receives
- Any reference apps or inspiration

---

### Step 2 — The Brief
Always include TWO dimensions:
- **Functional:** What does this screen show and do?
- **Emotional:** How should the user FEEL when they see it?

Example: "This is the post-workout summary screen. It should feel like 
opening your stats after a fight — proud, clear, complete. Celebratory 
but not over the top."

---

### Step 3 — The Persona
Never ask Claude to design without a high-stakes persona. Use this exact 
framing or a variation:

"You are a 160IQ specialist in UI and UX design. Apply this thinking to 
everything. You are presenting this screen to Steve Jobs and the entire 
Apple executive board. Your career is on the line. If you fail, it is 
career death. If you succeed, you are next in line as Steve's successor. 
Ultrathink."

---

### Step 4 — Force Self-Criticism
After every version Claude produces, ask:

- "Be brutally honest with yourself. What would you change?"
- "Gun to your head — what else is wrong with this?"
- "What would Steve Jobs say if he walked in right now?"
- "You're being too safe. What are you not telling me?"
- "Your newborn son needs his father. One final shot. What do you fix?"

Never skip this step. This is where the real improvements come from.
Claude finds more flaws in its own work than you will — but only when 
pushed to look.

---

### Step 5 — Escalate Until It Hurts
The framework for escalation:

1. Claude produces version 1
2. You analyze it and push back — "what else?"
3. Claude produces a critique of its own work
4. You escalate the stakes — Steve Jobs, gun to head, career death
5. Claude goes deeper — philosophical failures, emotional failures
6. You approve or push once more
7. Claude rebuilds from scratch incorporating everything
8. You review at 430px mobile in Chrome DevTools (iPhone 14 Pro Max)
9. Final corrections via targeted prompts

---

### Step 6 — The HTML Mockup Process
Every screen gets a pixel-perfect HTML reference file BEFORE Claude Code 
builds it. This is non-negotiable. The workflow:

1. Design HTML mockup here in claude.ai chat
2. Review at 430px in Chrome DevTools (iPhone 14 Pro Max)
3. Iterate until approved
4. Download HTML file → drop in lazyfit-web project root
5. Write Claude Code prompt referencing the HTML file
6. Claude Code implements it
7. Review built screen at 430px
8. Send screenshots back to claude.ai for correction prompts

HTML files live in: `lazyfit-web/` (project root)
Naming convention: `lazyfit_[screenname].html`

---

### Step 7 — Claude Code Prompt Structure
When prompting Claude Code to implement a designed screen, always include:

1. Path to the HTML reference file
2. Instruction to read CLAUDE.md first
3. The inline styles rule (no Tailwind color classes — inline styles only)
4. The font override rule (SF Pro Display via inline fontFamily on root div)
5. The exact design tokens (copy from globals.css section below)
6. All interactive states (empty, loading, error, over-target)
7. Mobile-first instruction (max-width 430px, test at iPhone 14 Pro Max)

---

### Design Tokens (use these everywhere, inline styles only)
Background:      #090909
Card:            #0e0e0e
Card elevated:   #181818
Border:          #1a1a1a
Border strong:   #242424
Text primary:    #f0f0f0
Text secondary:  #848484
Text dim:        #444444
Text ghost:      #282828
Accent green:    #3ecf8e
Accent bg:       #091510
Accent border:   #183525
Red (error):     #ff3b5c
Amber (warning): #f5a623
Blue (protein):  #4a9eff
Purple (snack):  #b66dff
Font:            -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif

---

### The One Rule That Overrides Everything
The user is the main character of their own story.
Every screen must make them feel that way.
Data serves emotion. Never the other way around.

---

## Multi-State Design Rule
Every screen must be designed for ALL user states before 
building. Explicitly design and account for:
- New user / empty state — zero data, just signed up
- Power user / full state — months of data, everything populated
- Mid-edit state — what a field looks like while being changed
- Error / loading state — data fails or is fetching

Components showing calculated data must reflect data quality.
A new user's nutrition estimate is less reliable than one with 
12 weeks of data — the UI must show that difference (confidence 
indicator, copy change, or visual treatment).

Every screen needs one moment of genuine delight — a 
transition, animation, or copy beat that makes the user feel 
something unexpected and good. Numbers that count up when a 
goal changes. A subtle pulse when data updates. These cost 
10 lines of code and separate memorable from forgettable.

---

### Screens Completed (HTML reference files ready)
- Dashboard: `lazyfit_dashboard.html` ✅
- Train / Routines: `lazyfit_train.html` ✅  
- Train / History: `lazyfit_history.html` ✅
- Active Workout: `lazyfit_active_workout_final.html` ✅
- Food Logging: `lazyfit_food_final.html` ✅
- Workout Summary: `lazyfit_summary_final.html` ✅
- Exercise History: `lazyfit_exercise_history.html` ✅
- Progress: `lazyfit_progress.html` ✅
- Profile: `lazyfit_profile.html` ✅

### Screens Remaining
- Onboarding wizard (multi-step, deferred post-MVP)

---

## Product Strategy

### Pricing & Community
- Primary offer: €1000/year — app + private group + weekly Q&A calls + full archive access
- Founding member offer (first 50 only): Year 2 free
- Monthly option: decision deferred post-launch
- Community platform: Telegram (higher adoption in Romanian market, not Discord)
- Annual members: full archive, PDFs, recordings
- Monthly members (if added): current week only, no archive access, different Telegram role

### App Features — MVP
- Progress screen: emotional hero statement, consistency heatmap, strength snapshot (top 4 exercises), body composition chart (weight + waist dual axis), PRs trophy case, rule-based coaching card
- Body measurements: weight (existing) + waist (to build)
- Coaching card: rule-based at launch, AI post-launch
- User goals: 3 options — recomposition / lean bulk / cut
  Collected at onboarding, editable in profile

### App Features — Post-Launch Backlog
- AI Coach chat tab (separate tab)
- Backdated body weight entry
- AI-powered coaching card
- Goal-switch recommendation from coaching engine
- Waist/weight trend → goal change suggestion

## Profile Screen — Decisions Made
- No full_name column in DB — add first_name + last_name columns
- Goal values: cut / recomp / lean_bulk
  Migrate any existing "bulk" values → "lean_bulk"
- Goal drives full recalculation on save:
  BMR: Mifflin-St Jeor formula
  TDEE: BMR × activity multiplier
  Cut: −400 kcal | Recomp: maintenance | Lean Bulk: +250 kcal
- Goal change: confirmation modal with full macro breakdown 
  and coach-voice explanation required before confirming
- Activity level: 5 options (Sedentary → Athlete)
  Shown with 5-step progress bar visual in the row
- Body fat: US Navy method (waist + neck + height)
  Neck measurement required — prompt user to log it
  Falls back to Mifflin-St Jeor if neck not logged yet
- Founding Member badge: amber #f5a623, trophy emoji
  Shown in profile header for beta users
- Units: kg/lbs toggle stored as preferred_units in profiles
- Inline editing: tap row → bottom drawer → save/cancel
- GDPR compliance required (EU/Romania PWA):
  Delete account must permanently erase all user data
  Privacy Policy link required on profile screen

## Nutrition & TDEE — Architecture Decision
MVP: Static Mifflin-St Jeor BMR + activity level multiplier
Post-MVP: Adaptive algorithm (MacroFactor-style) using actual
  logged weight + logged food to reverse-engineer real TDEE
  Do NOT build the adaptive layer until post-launch

## Test Users (Supabase)
newuser@lazyfit.test / testpass123 — "Alex", zero data
poweruser@lazyfit.test / testpass123 — "Maria", 6 months data

## Beta Launch Plan
First 50-100 users: free, no billing wired
Gather feedback for 4-8 weeks, then introduce pricing
Founding Member badge shown to all beta users
Pricing post-beta: €7-9/month or ~€60/year standard
€1000/year founding member offer (first 50, year 2 free)

### Coaching Card Rules
- Stored as separate config object, not hardcoded
- Rotates through applicable rules per session
- References user's name and goal
- Requires goal field on profiles table

### Data Rules
- Minimum 4 sessions per exercise before showing trend direction
- Trend states: Rising / Holding / Needs Attention
- Never show red — use amber for attention states
- Missed training days: gray (neutral), not red

---

@AGENTS.md
