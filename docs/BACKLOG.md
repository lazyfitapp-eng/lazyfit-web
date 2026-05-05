# Backlog

CURRENT_STATE.md ACTIVE STATE is the source of truth. This backlog is secondary and should be updated after major sprint decisions.

## Active / Near-Term Candidates

- Food Search Relevance Audit/Fix: audit/design first, identify the root cause, then implement only after the cause is known.
- Final P0/P1 release smoke before Friday sendable MVP push.
- Existing-user routine data/backfill policy follow-up, if needed.
- Onboarding regression check after future onboarding changes.

## Completed / Recently Landed

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
