-- Equipe por unidade: cada barbeiro pertence a uma unidade da barbearia.

ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS unit_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'barbers_unit_id_fkey'
  ) THEN
    ALTER TABLE barbers
      ADD CONSTRAINT barbers_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES barbershop_units(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_barbers_unit ON barbers(unit_id);
CREATE INDEX IF NOT EXISTS idx_barbers_barbershop_unit ON barbers(barbershop_id, unit_id);

ALTER TABLE barber_invites
  ADD COLUMN IF NOT EXISTS unit_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'barber_invites_unit_id_fkey'
  ) THEN
    ALTER TABLE barber_invites
      ADD CONSTRAINT barber_invites_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES barbershop_units(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Barbearias com uma única unidade: vincula equipe existente a ela.
UPDATE barbers b
SET unit_id = sub.unit_id
FROM (
  SELECT DISTINCT ON (bu.barbershop_id)
    bu.barbershop_id,
    bu.id AS unit_id
  FROM barbershop_units bu
  WHERE bu.active = true
  ORDER BY bu.barbershop_id, bu.created_at ASC
) sub
WHERE b.barbershop_id = sub.barbershop_id
  AND b.unit_id IS NULL
  AND (
    SELECT COUNT(*)::int
    FROM barbershop_units u
    WHERE u.barbershop_id = b.barbershop_id AND u.active = true
  ) = 1;
