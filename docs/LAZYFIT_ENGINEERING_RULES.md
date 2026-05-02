# LazyFit Engineering Rules

## 1. Core Product Principle

LazyFit must feel reliable, guided, and coach-like.

Do not patch visible symptoms without tracing the source of truth first. If a value is wrong on screen, the job is not finished until we understand where that value was created, how it was computed, where it was stored, where it was displayed, and whether any other screen uses the same value differently.

Private beta users should feel that LazyFit is calm, consistent, and trustworthy. A fast-looking fix that leaves inconsistent logic behind is not acceptable.

## 2. Source-of-Truth Rules

### Nutrition Targets

- All user-facing calorie and macro target displays must use `src/lib/nutritionTargets.ts`.
- The shared entry point is `resolveNutritionTargets(profile)`.
- Computed targets from profile inputs are preferred when available.
- Stored profile target fields may be used only as a fallback when computed inputs are missing.
- Logged food totals must never become calorie or macro targets.
- Dashboard, Profile, Food, Progress, and Weekly Check-In must not each invent their own target calculation rules.

### Food Totals

- Consumed calories and macros come from logged food entries for the selected date.
- Food totals are sums of logged meals/items only.
- Food totals must never be used as target calories, target protein, target carbs, or target fat.
- If no food is logged for a date, consumed totals are zero, while targets still come from the nutrition target source.

### Weekly Check-In

- Weekly Check-In may review progress and propose profile/nutrition changes.
- Weekly Check-In must not silently overwrite targets with logged food totals.
- Closing or dismissing Weekly Check-In must not mark it complete or write profile changes.
- Accepting a Weekly Check-In recommendation must make intentional, traceable writes only.
- Weekly Check-In should use the same nutrition target source as the rest of the app when displaying calorie or macro targets.

### Dashboard

- Dashboard is a display and routing hub, not an independent source of truth.
- Dashboard selected date controls the food totals shown for that date.
- Dashboard nutrition targets must come from `resolveNutritionTargets(profile)`.
- Dashboard food totals must come from logged food for the selected date.
- Dashboard route handoffs must preserve selected date when opening date-sensitive screens such as Food.

### Profile

- Profile is the user-facing place to view and edit personal settings.
- Profile target displays must use the same nutrition target helper as Dashboard, Food, and Progress.
- Profile saves are high-risk writes and must be inspected carefully before changes.
- If Profile writes stored target fields, those fields are fallback/display persistence, not permission for other screens to bypass shared target logic.

### Workout Progression

- Workout progression must be based on completed workout data and the existing progression/target logic.
- Workout summary interpretation must not rewrite progression rules unless explicitly requested.
- Estimated strength/performance should outrank raw load when deciding progress.
- Do not call heavier-but-worse performance progress if estimated performance does not support it.
- Summary copy must be confidence-aware: when history is thin, use baseline or consistency language.

### Selected Date

- Selected date is a shared UX contract across Dashboard, Food, and any date-sensitive summaries.
- Route handoff should use `?date=YYYY-MM-DD` where appropriate.
- Invalid or missing date query params must fall back safely to today.
- Changing selected date must affect displayed totals for that date only.
- Logging food for a selected historical date must not update today's totals.

## 3. Bug-Fix Protocol

For any bug involving shared values, inspect every part of the data path before coding:

- Where the value is created.
- Where the value is stored.
- Where the value is computed.
- Where the value is displayed.
- Where the value is written back.
- All dependent routes and screens.
- All related call sites.

Before implementing, explain the root cause in plain English. If the root cause is not known yet, keep diagnosing. Do not guess and patch the nearest visible component.

After fixing, verify the original screen and at least one other dependent screen that uses the same value.

## 4. UI Polish Protocol

For UI, layout, and readability tasks:

- Do not change business logic unless the task explicitly requires it.
- Do not change database writes.
- Do not change source-of-truth calculations.
- Keep the work scoped to the requested screen or component.
- Preserve the LazyFit dark/Matrix aesthetic while prioritizing readability and tappability.
- Mobile readability comes first for beta readiness.
- If a UI issue appears to be caused by data or state, stop and trace the data path before styling around it.

## 5. High-Risk Domains

Treat these areas as high-risk and inspect source-of-truth behavior before editing:

- Nutrition targets.
- Food totals.
- Selected date.
- Workout progression.
- Weekly check-in state.
- Profile saves.
- Auth and onboarding completion.
- Routine creation.
- Workout completion.

## 6. Codex Reporting Requirements

Every fix should report:

- Exact root cause.
- Source of truth.
- All call sites checked.
- Files changed.
- Blast radius.
- Manual test matrix.
- Typecheck result.

If typecheck was not run, say so clearly and explain why.

If a fix touches a high-risk domain, include before/after behavior using real examples whenever possible.

## 7. Current LazyFit Nutrition Law

All user-facing calorie and macro target displays must use `src/lib/nutritionTargets.ts` and `resolveNutritionTargets(profile)`.

Logged food totals must never become targets.

Examples:

- If a user has a computed target of 1,873 kcal and logs 616 kcal, the target remains 1,873 kcal.
- Remaining calories are `target - consumed`.
- Percent of target is `consumed / target`.
- If consumed calories are zero, the target still comes from the profile-derived target source.
- If stored target fields are corrupted, user-facing screens should prefer valid computed targets from profile inputs.
