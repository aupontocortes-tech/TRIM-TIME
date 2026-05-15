-- Integração Asaas: IDs externos na assinatura + catálogo de planos na plataforma
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_type TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_subscription
  ON subscriptions(asaas_subscription_id)
  WHERE asaas_subscription_id IS NOT NULL;

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS plan_configs JSONB,
  ADD COLUMN IF NOT EXISTS default_trial_days INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS default_trial_plan subscription_plan NOT NULL DEFAULT 'pro';
