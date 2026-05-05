# LazyFit Engineering Rules

## 1. Core Product Principle

LazyFit must feel reliable, guided, and coach-like.

Do not patch visible symptoms without tracing the source of truth first. If a value is wrong on screen, the job is not finished until we understand where that value was created, how it was computed, where it was stored, where it was displayed, and whether any other screen uses the same value differently.

Private beta users should feel that LazyFit is calm, consistent, and trustworthy. A fast-looking fix that leaves inconsistent logic behind is not acceptable.

## 2. LazyFit Codex Operating Contract

These rules are permanent repo-level workflow rules for Codex sessions. They apply before product work, validation work, deployment work, and docs-only work.

### State Check First

Every Codex session must start by running and reporting:

- `git status --short`
- `git branch --show-current`
- `git log -1 --oneline`
- `git rev-parse HEAD`

Then read:

- `AGENTS.md`
- `CURRENT_STATE.md` ACTIVE STATE
- `docs/LAZYFIT_ENGINEERING_RULES.md`
- `docs/BACKLOG.md` when relevant

Before starting a sprint, state:

- Current phase.
- Latest pushed commit / repo state.
- Known product decisions.
- Known test accounts or environment constraints.
- Current blocker or opportunity.
- Why this sprint is next.
- What is explicitly not being done.

### Source-of-Truth Hierarchy

Use this order:

1. `CURRENT_STATE.md` ACTIVE STATE.
2. `docs/LAZYFIT_ENGINEERING_RULES.md`.
3. Committed repo code.
4. Committed docs.
5. Current Codex report / chat context.
6. Untracked docs only if explicitly referenced.

Chat memory and Codex reports are not canonical until written into committed docs or code. `docs/QA_FINDINGS.md` is untracked unless explicitly staged and committed.

### Mode Declaration

Every task must declare exactly one mode:

- audit/design only
- implementation
- validation/smoke
- deployment
- docs-only
- validation-runner creation only

Codex must not silently switch modes. If a task needs a different mode, report the boundary and wait for the next explicit instruction.

### Sprint Flow

For major product work, use this sequence:

1. Research / inspect references.
2. Audit current app/code.
3. Product decision.
4. Implementation sprint.
5. Browser validation.
6. Report.
7. Human commit/push.
8. Update `CURRENT_STATE.md` if project state changed.

### Autonomous Loop Rule

For implementation and validation tasks, Codex should not stop at the first minor blocker. Codex should autonomously loop through:

- Code inspection.
- Command failures.
- TypeScript/build errors.
- Validation-script repair.
- DB/API checks.
- Safe test-data investigation.

Keep looping for roughly 20-30 minutes unless:

- Destructive approval is required.
- Secrets are missing.
- Real product or data risk is discovered.
- A capability boundary is hit.
- The task is complete.

### No Giant Manual Script Rule

Codex must not make Tudor paste giant browser or PowerShell scripts.

For browser/UI validation, Codex should create temporary runners under:

```text
.codex-temp/<sprint-name>/
```

Then Tudor should run one short command:

```powershell
powershell -ExecutionPolicy Bypass -File .\.codex-temp\<sprint-name>\run.ps1
```

### Temporary Runner Rule

Temporary runners must:

- Live under `.codex-temp/`.
- Be deleted before commit unless explicitly kept.
- Never modify app source or package files.
- Output Markdown and JSON reports.
- Save screenshots and artifacts under the same temp folder.
- Clearly report any QA data created or mutated.

Use temporary runners only for validation support or explicitly requested validation-runner creation. They are not a backdoor for product changes.

### Browser Validation Rule

Any UI change requires browser validation. Do not call UI work safe to commit on typecheck alone.

Codex direct Brave/Playwright launch has repeatedly failed with `browserType.launch: spawn EPERM`. Therefore:

- Codex should not waste time retrying direct browser launch repeatedly.
- Codex may create local Playwright runners.
- Tudor runs the local runner from normal PowerShell.
- Browser validation is not complete until the local runner passes or the blocker is explicitly reported.

### Data Safety Rule

- Do not mutate real user data.
- QA data belongs only under disposable QA accounts.
- Do not delete production or QA rows without explicit action-time confirmation.
- For created test rows, report IDs/counts before cleanup.
- Report every QA row created or mutated.
- Do not change env vars, DNS, Supabase settings, or Vercel settings unless the task explicitly asks.

Never touch production settings/env/DNS/Supabase/Vercel unless the sprint explicitly requires it.

### Parallel Session Rule

Parallel Codex sessions are allowed only if scopes do not overlap.

Safe examples:

- One implementation/deploy session.
- One audit-only session.
- One docs-only workflow session.

Unsafe examples:

- Two sessions editing the same files.
- Two sessions editing the same feature area.

If using parallel implementation, use an isolated worktree/branch and report it.

### Commit Rule

- Codex does not commit or push.
- Tudor commits manually after ChatGPT review.
- One coherent sprint equals one coherent commit.

### Report Format

Every report must include:

- State check.
- Mode.
- Files changed.
- Validation run.
- Data created/mutated.
- Risks.
- Final git status.
- Suggested commit message.

For code fixes, also include exact root cause, source of truth, all call sites checked, blast radius, manual test matrix, and typecheck result when relevant.

### Sendable MVP Rule

Until the Friday release push:

- No broad "while here" work.
- No new major systems after Weekly Check-In Step Average unless explicitly approved.
- Prioritize P0/P1 trust blockers.
- Food search relevance and training logging reliability are release-critical.

### Do Not Do

- Do not paste giant scripts to Tudor.
- Do not fake browser validation.
- Do not call typecheck enough for UI.
- Do not modify `docs/QA_FINDINGS.md` unless asked.
- Do not silently delete QA data.
- Do not make calorie changes from steps.
- Do not add dashboard cards or a recommendation engine unless the sprint asks.

### Research Rule

For major feature/design decisions, use external research before implementation when relevant. Use official docs first, competitor references when useful, and summarize principles before code.

Examples:

- Steps/smart engine.
- Food logger major changes.
- Training architecture.
- Native/PWA capabilities.

### Anti-Drift Rules

- No friends beta unless Tudor explicitly asks.
- No broad "while here" fixes.
- No new feature during audit.
- No implementation before product decision for major systems.
- No stale-doc assumptions.

## 3. Source-of-Truth Rules

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

## 4. Bug-Fix Protocol

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

## 5. UI Polish Protocol

For UI, layout, and readability tasks:

- Do not change business logic unless the task explicitly requires it.
- Do not change database writes.
- Do not change source-of-truth calculations.
- Keep the work scoped to the requested screen or component.
- Preserve the LazyFit dark/Matrix aesthetic while prioritizing readability and tappability.
- Mobile readability comes first for beta readiness.
- If a UI issue appears to be caused by data or state, stop and trace the data path before styling around it.

## 6. High-Risk Domains

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

## 7. Codex Reporting Requirements

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

## 8. Current LazyFit Nutrition Law

All user-facing calorie and macro target displays must use `src/lib/nutritionTargets.ts` and `resolveNutritionTargets(profile)`.

Logged food totals must never become targets.

Examples:

- If a user has a computed target of 1,873 kcal and logs 616 kcal, the target remains 1,873 kcal.
- Remaining calories are `target - consumed`.
- Percent of target is `consumed / target`.
- If consumed calories are zero, the target still comes from the profile-derived target source.
- If stored target fields are corrupted, user-facing screens should prefer valid computed targets from profile inputs.
