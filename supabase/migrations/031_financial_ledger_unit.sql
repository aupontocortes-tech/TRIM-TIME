-- Despesas da loja: unidade + fornecedor + timestamps
ALTER TABLE financial_ledger_entries
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES barbershop_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_financial_ledger_barbershop_unit_time
  ON financial_ledger_entries(barbershop_id, unit_id, occurred_at);
