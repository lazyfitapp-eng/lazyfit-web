-- Add the selected lower-day variant for the 3-day LazyFit program.
-- Existing users keep the back-friendly lower day by default.
-- Safe to run multiple times.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lower_day_style text DEFAULT 'back_friendly';

UPDATE profiles
SET lower_day_style = 'back_friendly'
WHERE lower_day_style IS NULL
   OR lower_day_style NOT IN ('back_friendly', 'barbell');

ALTER TABLE profiles
  ALTER COLUMN lower_day_style SET DEFAULT 'back_friendly',
  ALTER COLUMN lower_day_style SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_lower_day_style_check
    CHECK (lower_day_style IN ('back_friendly', 'barbell'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
