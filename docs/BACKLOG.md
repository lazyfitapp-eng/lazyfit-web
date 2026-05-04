# Backlog

CURRENT_STATE.md ACTIVE STATE is the source of truth. This backlog is secondary and should be updated after major sprint decisions.

## Active / Near-Term Candidates

- Weekly Check-In Step Average - Production Deploy + Smoke: deploy the locally validated sprint and smoke production.
- Existing-user routine data/backfill policy follow-up, if needed.
- Onboarding regression check after future onboarding changes.

## Completed / Recently Landed

- Steps / Smart Engine V1 - Weekly Check-In Step Average: implemented and locally validated. Added `public.weekly_checkins`; weekly steps are stored separately from `profiles.daily_steps`; no dashboard Activity Floor card, recommendation engine, earned calories, or calorie banking was added.
- Steps / Smart Engine V1 - Activity Floor Baseline: implemented and locally browser-validated. Reuses `profiles.daily_steps`; no new profile column, `weekly_checkins` table, device step integration, or calorie-burn banking.

## Product/System Backlog

- Steps / smart engine future rules and coaching recommendations.
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
