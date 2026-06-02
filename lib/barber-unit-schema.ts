import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

let schemaReadyPromise: Promise<void> | null = null
let resolvedBarbersTable: string | null = null

function isMissingUnitIdColumnError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes("does not exist") &&
    (msg.includes("unit_id") || msg.includes("unitId") || msg.includes("(not available)"))
  )
}

function isRelationDoesNotExistError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes("42P01") || (msg.includes("does not exist") && msg.includes("relation"))
}

/** Nome físico da tabela: migrações SQL usam `barbers`; Prisma db push costuma criar `"Barber"`. */
async function getBarbersTableName(): Promise<string> {
  if (resolvedBarbersTable) return resolvedBarbersTable

  const rows = await prisma.$queryRaw<{ table_name: string }[]>(Prisma.sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('barbers', 'Barber')
    LIMIT 1
  `)

  if (rows[0]?.table_name) {
    resolvedBarbersTable = rows[0].table_name
    return resolvedBarbersTable
  }

  try {
    await prisma.$queryRaw(Prisma.sql`SELECT 1 FROM barbers LIMIT 1`)
    resolvedBarbersTable = "barbers"
  } catch {
    resolvedBarbersTable = "Barber"
  }
  return resolvedBarbersTable
}

function quoteTable(name: string): string {
  return name === "Barber" ? '"Barber"' : "barbers"
}

async function barbersTableHasUnitIdColumn(table: string): Promise<boolean> {
  const tableName = table === "Barber" ? "Barber" : "barbers"
  try {
    const rows = await prisma.$queryRaw<{ ok: number }[]>(Prisma.sql`
      SELECT 1 AS ok
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = 'unit_id'
      LIMIT 1
    `)
    return rows.length > 0
  } catch {
    return false
  }
}

/** Garante coluna `unit_id` na tabela de barbeiros — idempotente. */
export async function ensureBarbersUnitSchemaReady(): Promise<void> {
  const table = await getBarbersTableName()
  const q = quoteTable(table)

  if (await barbersTableHasUnitIdColumn(table)) return

  await prisma.$executeRawUnsafe(`ALTER TABLE ${q} ADD COLUMN IF NOT EXISTS unit_id UUID;`)

  const fkName = table === "Barber" ? "Barber_unit_id_fkey" : "barbers_unit_id_fkey"
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = '${fkName}'
      ) THEN
        ALTER TABLE ${q}
          ADD CONSTRAINT ${fkName}
          FOREIGN KEY (unit_id) REFERENCES barbershop_units(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  const idxUnit = table === "Barber" ? "Barber_unit_id_idx" : "idx_barbers_unit"
  const idxShopUnit = table === "Barber" ? "Barber_barbershop_id_unit_id_idx" : "idx_barbers_barbershop_unit"
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${idxUnit} ON ${q}(unit_id);`)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS ${idxShopUnit} ON ${q}(barbershop_id, unit_id);`
  )

  await prisma.$executeRawUnsafe(`
    ALTER TABLE barber_invites ADD COLUMN IF NOT EXISTS unit_id UUID;
  `)

  await prisma.$executeRawUnsafe(`
    UPDATE ${q} b
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
        WHERE u.barbershop_id = b.barbershop_id
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
    if (isMissingUnitIdColumnError(e) || isRelationDoesNotExistError(e)) {
      resolvedBarbersTable = null
      schemaReadyPromise = null
      await ensureBarbersUnitSchemaReady()
      schemaReadyPromise = Promise.resolve()
      return await fn()
    }
    throw e
  }
}
