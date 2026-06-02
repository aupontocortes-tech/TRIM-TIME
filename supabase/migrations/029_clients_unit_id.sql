-- Clientes por unidade: cadastro e listagem no painel respeitam a loja ativa.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS unit_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_unit_id_fkey'
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT clients_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES barbershop_units(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_unit ON clients(unit_id);
CREATE INDEX IF NOT EXISTS idx_clients_barbershop_unit ON clients(barbershop_id, unit_id);

-- Barbearias com uma única unidade: vincula clientes existentes a ela.
UPDATE clients c
SET unit_id = sub.unit_id
FROM (
  SELECT DISTINCT ON (bu.barbershop_id)
    bu.barbershop_id,
    bu.id AS unit_id
  FROM barbershop_units bu
  WHERE bu.active = true
  ORDER BY bu.barbershop_id, bu.created_at ASC
) sub
WHERE c.barbershop_id = sub.barbershop_id
  AND c.unit_id IS NULL
  AND (
    SELECT COUNT(*)::int
    FROM barbershop_units u
    WHERE u.barbershop_id = c.barbershop_id AND u.active = true
  ) = 1;
