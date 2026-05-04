# Backlog

CURRENT_STATE.md ACTIVE STATE is the source of truth. This backlog is secondary and should be updated after major sprint decisions.

## Active / Near-Term Candidates

- Steps / Smart Engine V1 - Weekly Check-In Step Average: implementation; add manual weekly average step input/persistence only. No dashboard Activity Floor card or recommendation engine unless explicitly approved.
- Existing-user routine data/backfill policy follow-up, if needed.
- Onboarding regression check after future onboarding changes.

## Completed / Recently Landed

- Steps / Smart Engine V1 - Activity Floor Baseline: implemented and locally browser-validated. Reuses `profiles.daily_steps`; no new profile column, `weekly_checkins` table, device step integration, or calorie-burn banking.

## Product/System Backlog

- Steps / smart engine future rules and coaching recommendations.
- Adaptive TDEE algorithm.
- Weekly check-in adaptive loop.
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
