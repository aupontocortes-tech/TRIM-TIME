-- Corrige registros criados quando default_trial_days era 2 (migration 020).
UPDATE platform_settings
SET default_trial_days = 7
WHERE id = 'singleton' AND default_trial_days < 7;

-- plan_configs JSON pode ter trialDays antigo (2).
UPDATE platform_settings
SET plan_configs = jsonb_set(
  COALESCE(plan_configs::jsonb, '{}'::jsonb),
  '{trialDays}',
  '7'::jsonb,
  true
)
WHERE id = 'singleton'
  AND plan_configs IS NOT NULL
  AND (plan_configs::jsonb ->> 'trialDays')::int IS NOT NULL
  AND (plan_configs::jsonb ->> 'trialDays')::int < 7;
