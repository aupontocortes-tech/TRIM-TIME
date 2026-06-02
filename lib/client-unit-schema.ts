import { prisma } from "@/lib/prisma"

/** Garante coluna `unit_id` em clientes — idempotente (migração 029). */
export async function ensureClientsUnitSchemaReady(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS unit_id UUID;
  `)

  await prisma.$executeRawUnsafe(`
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
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_clients_unit ON clients(unit_id);
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_clients_barbershop_unit ON clients(barbershop_id, unit_id);
  `)
}
