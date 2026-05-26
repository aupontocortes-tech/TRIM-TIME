-- Super Admin: role e suspensão em barbershops
ALTER TABLE barbershops
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_barbershops_role ON barbershops(role);
CREATE INDEX IF NOT EXISTS idx_barbershops_suspended_at ON barbershops(suspended_at) WHERE suspended_at IS NOT NULL;

COMMENT ON COLUMN barbershops.role IS 'admin = super admin do sistema; user = barbearia normal';
