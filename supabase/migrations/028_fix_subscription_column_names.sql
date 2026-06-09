-- Corrige nomes camelCase → snake_case na tabela "Subscription" (Prisma espera snake_case).
-- Rode no Supabase (projeto jthbtphy) se Minha assinatura ainda der erro de coluna.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Subscription' AND column_name = 'barbershopId') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "barbershopId" TO barbershop_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Subscription' AND column_name = 'trialEnd') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "trialEnd" TO trial_end;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Subscription' AND column_name = 'nextPayment') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "nextPayment" TO next_payment;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Subscription' AND column_name = 'createdAt') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "createdAt" TO created_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Subscription' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "updatedAt" TO updated_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Subscription' AND column_name = 'asaasCustomerId') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "asaasCustomerId" TO asaas_customer_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Subscription' AND column_name = 'asaasSubscriptionId') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "asaasSubscriptionId" TO asaas_subscription_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Subscription' AND column_name = 'billingType') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "billingType" TO billing_type;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Subscription' AND column_name = 'cardSetupAt') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "cardSetupAt" TO card_setup_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Subscription' AND column_name = 'postTrialChoice') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "postTrialChoice" TO post_trial_choice;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Subscription' AND column_name = 'graceAccessUntil') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "graceAccessUntil" TO grace_access_until;
  END IF;
END $$;
