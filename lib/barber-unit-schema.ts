import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

let schemaReadyPromise: Promise<void> | null = null

function isMissingUnitIdColumnError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes("does not exist") &&
    (msg.includes("unit_id") || msg.includes("unitId") || msg.includes("(not available)"))
  )
}

async function barbersTableHasUnitIdColumn(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ ok: number }[]>(Prisma.sql`
      SELECT 1 AS ok
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'barbers'
        AND column_name = 'unit_id'
      LIMIT 1
    `)
    return rows.length > 0
  } catch {
    return false
  }
}

/** Garante coluna `unit_id` em barbers (migration 028) — idempotente, seguro rodar várias vezes. */
export async function ensureBarbersUnitSchemaReady(): Promise<void> {
  if (await barbersTableHasUnitIdColumn()) return

  await prisma.$executeRawUnsafe(`
    ALTER TABLE barbers ADD COLUMN IF NOT EXISTS unit_id UUID;
  `)

  await prisma.$executeRawUnsafe(`
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
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_barbers_unit ON barbers(unit_id);
    CREATE INDEX IF NOT EXISTS idx_barbers_barbershop_unit ON barbers(barbershop_id, unit_id);
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE barber_invites ADD COLUMN IF NOT EXISTS unit_id UUID;
  `)

  await prisma.$executeRawUnsafe(`
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
  `)
}

export function ensureBarbersUnitSchemaReadyOnce(): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureBarbersUnitSchemaReady().catch((e) => {
      schemaReadyPromise = null
      throw e
    })
  }
  return schemaReadyPromise
}

export async function withBarbersUnitSchema<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await ensureBarbersUnitSchemaReadyOnce()
    return await fn()
  } catch (e) {
    if (!isMissingUnitIdColumnError(e)) throw e
    await ensureBarbersUnitSchemaReady()
    schemaReadyPromise = Promise.resolve()
    return await fn()
  }
}
