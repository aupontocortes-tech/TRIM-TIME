-- Período de acesso após recusar assinatura pós-trial (Prisma: graceAccessUntil)
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS grace_access_until TIMESTAMPTZ;

-- Ambiente que ainda usa nome em minúsculas
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS grace_access_until TIMESTAMPTZ;
