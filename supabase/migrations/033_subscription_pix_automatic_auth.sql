-- Pix Automático (Asaas): autorização recorrente na assinatura
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS asaas_pix_automatic_auth_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_pix_automatic_auth
  ON subscriptions(asaas_pix_automatic_auth_id)
  WHERE asaas_pix_automatic_auth_id IS NOT NULL;
