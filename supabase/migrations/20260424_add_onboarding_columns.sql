ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth        date,
  ADD COLUMN IF NOT EXISTS job_activity         text,
  ADD COLUMN IF NOT EXISTS daily_steps          text,
  ADD COLUMN IF NOT EXISTS tdee_kcal            integer,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
