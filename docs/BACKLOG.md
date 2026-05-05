# Backlog

CURRENT_STATE.md ACTIVE STATE is the source of truth. This backlog is secondary and should be updated after major sprint decisions.

## Active / Near-Term Candidates

- Food Search Relevance Fix - Production Deploy + Smoke: deploy the locally validated fix, then smoke `/food`, food search relevance, food logging, Dashboard totals, target integrity, and runtime/network cleanliness.
- Final P0/P1 release smoke before Friday sendable MVP push.
- Existing-user routine data/backfill policy follow-up, if needed.
- Onboarding regression check after future onboarding changes.

## Completed / Recently Landed

- Food Search Relevance Fix: implemented and locally validated. Added intent-aware relevance, branded/product-style USDA source strategy where appropriate, richer source/serving/macro metadata in search results/UI, and low-confidence honest fallback behavior. Benchmark improved Critical 20 from 14/20 to 20/20 and Extended set from 16/35 to 35/35 pass-or-honest-fallback, with 0 absurd/no-fallback benchmark failures remaining. Local browser validation passed through `.codex-temp/food-search-relevance-fix/run-browser-validation.ps1`. Production deployment is pending.
- Weekly Check-In Production Deploy + Smoke: production-deployed and production-smoke-validated at `ad515ab` with `.codex-temp/profile-weekly-production-smoke/run.ps1` PASS.
- Profile nutrition target fallback hardening: production-deployed and production-smoke-validated.
- PWA icon asset fix: production-deployed and production-smoke-validated; missing `/icon-192.png` and `/icon-512.png` were fixed by `ad515ab`.
- Steps / Smart Engine V1 - Weekly Check-In Step Average: implemented, locally validated, production-deployed, and production-smoke-validated. Added `public.weekly_checkins`; weekly steps are stored separately from `profiles.daily_steps`; no dashboard Activity Floor card, recommendation engine, earned calories, or calorie banking was added.
- Steps / Smart Engine V1 - Activity Floor Baseline: implemented, production-deployed, and production-smoke-validated. Reuses `profiles.daily_steps`; no new profile column, device step integration, or calorie-burn banking.

## Product/System Backlog

- Steps / smart engine future recommendation rules and coaching recommendations.
- Adaptive TDEE algorithm.
- Weekly check-in adaptive loop.
- Dashboard Activity Floor card.
- Profile-level lower-day switching polish.
- Saved meals.
- Barcode.
- OpenFoodFacts integration.
- Custom foods.
- Deeper food database/ranking improvements.
- Backdated weight entry.
- Waist logging / body measurement improvements.
- AI coach chat tab.
- Paywall / Stripe.
- Rate limiting.

## Media/Content Backlog

- Exercise GIFs / LazyFit exercise demo videos.

## Explicitly Not Current Blockers

- Food Logger core loop is paused/good enough for now.
- Training core hardening is mostly complete.
- Existing users should not be silently routine-backfilled.
- Friends beta only when Tudor explicitly asks.
