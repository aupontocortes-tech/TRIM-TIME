-- Trim Time — extensões estruturais (Supabase)
-- Rode no SQL Editor após backup. Alinha com prisma/schema.prisma.

-- ---------- Multi-unidade (opcional) ----------
CREATE TABLE IF NOT EXISTS barbershop_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_barbershop_units_barbershop ON barbershop_units(barbershop_id);

-- ---------- Colunas em tabelas existentes ----------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;

ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS auth_user_id TEXT;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS unit_id UUID;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2);

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2);

-- FK unit_id (só se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_unit_id_fkey'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES barbershop_units(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_unit ON appointments(unit_id);

-- ---------- Pagamentos (estrutura) ----------
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_id TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL,
  plan subscription_plan,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_barbershop ON payments(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_payments_external ON payments(external_id);

-- ---------- Ledger financeiro ----------
CREATE TABLE IF NOT EXISTS financial_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  note TEXT,
  metadata JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_ledger_barbershop_time ON financial_ledger_entries(barbershop_id, occurred_at);

-- ---------- Fidelidade (histórico) ----------
CREATE TABLE IF NOT EXISTS loyalty_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  delta_points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_client ON loyalty_ledger_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_barbershop ON loyalty_ledger_entries(barbershop_id);

-- ---------- Marketing ----------
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_barbershop ON marketing_campaigns(barbershop_id);
