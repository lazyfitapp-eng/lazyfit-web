-- Add progression counter columns to exercise_targets
-- These track consecutive sessions where the user hit max reps or failed min reps,
-- enabling the 2-session-max → bump / 3-session-fail → deload progression logic.
--
-- Safe to run multiple times (IF NOT EXISTS).
-- Existing rows automatically receive the default value of 0.
-- RLS policy already covers this table via auth.uid() = user_id — no new policy needed.
-- Composite PK (user_id, exercise_name, set_number) already exists — not re-declared here.

ALTER TABLE exercise_targets
  ADD COLUMN IF NOT EXISTS consecutive_max_sessions  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consecutive_fail_sessions integer NOT NULL DEFAULT 0;
