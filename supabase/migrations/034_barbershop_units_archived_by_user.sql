-- Distingue arquivamento manual (dono) de arquivamento automático legado (política de plano).
-- Unidades com active=false e archived_by_user=false podem ser reativadas ao restaurar Premium.
ALTER TABLE barbershop_units
  ADD COLUMN IF NOT EXISTS archived_by_user boolean NOT NULL DEFAULT false;
