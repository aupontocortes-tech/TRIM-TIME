-- Colunas de cobrança Asaas / trial na tabela subscriptions (assinatura no painel).
-- Rode no SQL Editor do Supabase se a página Minha assinatura mostrar erro de coluna Prisma.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_type TEXT,
  ADD COLUMN IF NOT EXISTS card_setup_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS post_trial_choice TEXT,
  ADD COLUMN IF NOT EXISTS grace_access_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_subscription
  ON subscriptions(asaas_subscription_id)
  WHERE asaas_subscription_id IS NOT NULL;
