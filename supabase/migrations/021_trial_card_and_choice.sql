ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS card_setup_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS post_trial_choice TEXT;

ALTER TABLE platform_settings
  ALTER COLUMN default_trial_days SET DEFAULT 7;
