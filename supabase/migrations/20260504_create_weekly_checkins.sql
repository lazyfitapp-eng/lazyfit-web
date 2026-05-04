-- Create weekly check-in persistence for manual weekly step averages.
-- Steps are stored as coaching context only; they do not update profile targets.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.weekly_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  avg_daily_steps integer,
  steps_skipped boolean NOT NULL DEFAULT false,
  activity_floor_at_checkin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_checkins
  ADD COLUMN IF NOT EXISTS avg_daily_steps integer,
  ADD COLUMN IF NOT EXISTS steps_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activity_floor_at_checkin text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  ALTER TABLE public.weekly_checkins
    ADD CONSTRAINT weekly_checkins_user_week_unique UNIQUE (user_id, week_start);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.weekly_checkins
    ADD CONSTRAINT weekly_checkins_avg_daily_steps_check
    CHECK (avg_daily_steps IS NULL OR (avg_daily_steps >= 0 AND avg_daily_steps <= 50000));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.weekly_checkins
    ADD CONSTRAINT weekly_checkins_skipped_steps_null_check
    CHECK (NOT steps_skipped OR avg_daily_steps IS NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.weekly_checkins
    ADD CONSTRAINT weekly_checkins_steps_present_not_skipped_check
    CHECK (avg_daily_steps IS NULL OR steps_skipped = false);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.set_weekly_checkins_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS weekly_checkins_set_updated_at ON public.weekly_checkins;

CREATE TRIGGER weekly_checkins_set_updated_at
BEFORE UPDATE ON public.weekly_checkins
FOR EACH ROW
EXECUTE FUNCTION public.set_weekly_checkins_updated_at();

ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'weekly_checkins'
      AND policyname = 'Users can select own weekly checkins'
  ) THEN
    CREATE POLICY "Users can select own weekly checkins"
      ON public.weekly_checkins
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'weekly_checkins'
      AND policyname = 'Users can insert own weekly checkins'
  ) THEN
    CREATE POLICY "Users can insert own weekly checkins"
      ON public.weekly_checkins
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'weekly_checkins'
      AND policyname = 'Users can update own weekly checkins'
  ) THEN
    CREATE POLICY "Users can update own weekly checkins"
      ON public.weekly_checkins
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
