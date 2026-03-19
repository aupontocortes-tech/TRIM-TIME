-- Sistema de permissões: super_admin, admin_barbershop, user
-- barbershops.role: super_admin (dono do sistema) | admin_barbershop (dono da barbearia)
-- barbers.role: admin_barbershop (dono) | user (barbeiro normal) — para futuro login de barbeiros

-- 1) Atualizar roles em barbershops: admin -> super_admin, user -> admin_barbershop
UPDATE barbershops SET role = 'super_admin' WHERE role = 'admin';
UPDATE barbershops SET role = 'admin_barbershop' WHERE role = 'user';

-- 2) Alterar constraint e default
ALTER TABLE barbershops DROP CONSTRAINT IF EXISTS barbershops_role_check;
ALTER TABLE barbershops ADD CONSTRAINT barbershops_role_check
  CHECK (role IN ('super_admin', 'admin_barbershop'));
ALTER TABLE barbershops ALTER COLUMN role SET DEFAULT 'admin_barbershop';

COMMENT ON COLUMN barbershops.role IS 'super_admin = dono do sistema (painel /admin); admin_barbershop = dono da barbearia';

-- 3) Role em barbers (para futuro: menu limitado para barbeiro "user" = só agenda e clientes)
ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('admin_barbershop', 'user'));

COMMENT ON COLUMN barbers.role IS 'admin_barbershop = dono da barbearia; user = barbeiro normal (agenda e clientes apenas)';

CREATE INDEX IF NOT EXISTS idx_barbers_role ON barbers(barbershop_id, role);
