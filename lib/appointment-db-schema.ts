import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ensureBarbersUnitSchemaReadyOnce } from "@/lib/barber-unit-schema"

let schemaReadyPromise: Promise<void> | null = null
let resolvedAppointmentsTable: string | null = null
let resolvedServicesTable: string | null = null
let unitColumnReadyCache: boolean | null = null

function isAppointmentSchemaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes("42P01") ||
    ((msg.includes("does not exist") || msg.includes("(not available)")) &&
      (msg.includes("appointments") ||
        msg.includes("Appointment") ||
        msg.includes("services") ||
        msg.includes("Service") ||
        msg.includes("unit_id") ||
        msg.includes("unitId") ||
        msg.includes("commission_percent") ||
        msg.includes("commission_amount") ||
        msg.includes("appointment_service_lines") ||
        msg.includes("photo_scale") ||
        msg.includes("photo_position") ||
        msg.includes("clients") ||
        msg.includes("Client")))
  )
}

/** Tabela que o Prisma Client usa para o model Appointment (com ou sem @@map). */
export function getPrismaModelTableName(model: string): string {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model)
  return m?.dbName ?? model
}

function quoteTable(name: string): string {
  if (
    name === "Appointment" ||
    name === "Barber" ||
    name === "Client" ||
    name === "Service"
  ) {
    return `"${name}"`
  }
  return name
}

let resolvedClientsTable: string | null = null

/** Nome físico da tabela de clientes (Prisma `Client` ou migração SQL `clients`). */
export async function getClientsTableName(): Promise<string> {
  if (resolvedClientsTable) return resolvedClientsTable

  const prismaTable = getPrismaModelTableName("Client")
  if (await tableExists(prismaTable)) {
    resolvedClientsTable = prismaTable
    return resolvedClientsTable
  }

  const rows = await prisma.$queryRaw<{ table_name: string }[]>(Prisma.sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('clients', 'Client')
    ORDER BY CASE table_name WHEN 'clients' THEN 0 ELSE 1 END
    LIMIT 1
  `)

  if (rows[0]?.table_name) {
    resolvedClientsTable = rows[0].table_name
    return resolvedClientsTable
  }

  resolvedClientsTable = prismaTable
  return resolvedClientsTable
}

async function clientsTableHasColumn(table: string, columnName: string): Promise<boolean> {
  return appointmentsTableHasColumn(table, columnName)
}

/** Coluna `unit_id` em clientes (migração 029 / painel multi-unidade). */
export async function ensureClientsUnitSchemaReady(): Promise<void> {
  const table = await getClientsTableName()
  if (await clientsTableHasColumn(table, "unit_id")) return

  const q = quoteTable(table)
  await prisma.$executeRawUnsafe(`ALTER TABLE ${q} ADD COLUMN IF NOT EXISTS unit_id UUID;`)

  const fkName = table === "Client" ? "Client_unit_id_fkey" : "clients_unit_id_fkey"
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

  const idxUnit = table === "Client" ? "Client_unit_id_idx" : "idx_clients_unit"
  const idxShopUnit =
    table === "Client" ? "Client_barbershop_id_unit_id_idx" : "idx_clients_barbershop_unit"
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${idxUnit} ON ${q}(unit_id);`)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS ${idxShopUnit} ON ${q}(barbershop_id, unit_id);`
  )

  await prisma.$executeRawUnsafe(`
    UPDATE ${q} c
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
  `)
}

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `)
  return !!rows[0]?.exists
}

/** Nome físico da tabela de agendamentos (prioriza a que o Prisma usa). */
export async function getAppointmentsTableName(): Promise<string> {
  if (resolvedAppointmentsTable) return resolvedAppointmentsTable

  const prismaTable = getPrismaModelTableName("Appointment")
  if (await tableExists(prismaTable)) {
    resolvedAppointmentsTable = prismaTable
    return resolvedAppointmentsTable
  }

  const rows = await prisma.$queryRaw<{ table_name: string }[]>(Prisma.sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('appointments', 'Appointment')
    ORDER BY CASE table_name WHEN 'appointments' THEN 0 ELSE 1 END
    LIMIT 1
  `)

  if (rows[0]?.table_name) {
    resolvedAppointmentsTable = rows[0].table_name
    return resolvedAppointmentsTable
  }

  resolvedAppointmentsTable = prismaTable
  return resolvedAppointmentsTable
}

async function getServicesTableName(): Promise<string> {
  if (resolvedServicesTable) return resolvedServicesTable

  const prismaTable = getPrismaModelTableName("Service")
  if (await tableExists(prismaTable)) {
    resolvedServicesTable = prismaTable
    return resolvedServicesTable
  }

  resolvedServicesTable = "services"
  return resolvedServicesTable
}

async function appointmentsTableHasColumn(table: string, columnName: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${table}
          AND column_name = ${columnName}
      ) AS "exists"
    `)
    return !!rows[0]?.exists
  } catch {
    return false
  }
}

export async function appointmentsUnitColumnReady(): Promise<boolean> {
  if (unitColumnReadyCache !== null) return unitColumnReadyCache
  const table = await getAppointmentsTableName()
  unitColumnReadyCache = await appointmentsTableHasColumn(table, "unit_id")
  return unitColumnReadyCache
}

function invalidateAppointmentSchemaCache() {
  resolvedAppointmentsTable = null
  resolvedServicesTable = null
  resolvedClientsTable = null
  unitColumnReadyCache = null
}

/** Colunas extras em agendamentos (migração 004). */
export async function ensureAppointmentsUnitSchemaReady(): Promise<void> {
  const table = await getAppointmentsTableName()
  const q = quoteTable(table)

  const needsUnitId = !(await appointmentsTableHasColumn(table, "unit_id"))
  const needsCommissionPct = !(await appointmentsTableHasColumn(table, "commission_percent"))
  const needsCommissionAmt = !(await appointmentsTableHasColumn(table, "commission_amount"))

  if (!needsUnitId && !needsCommissionPct && !needsCommissionAmt) {
    unitColumnReadyCache = true
    return
  }

  if (needsUnitId) {
    await prisma.$executeRawUnsafe(`ALTER TABLE ${q} ADD COLUMN IF NOT EXISTS unit_id UUID;`)
    const fkName = table === "Appointment" ? "Appointment_unit_id_fkey" : "appointments_unit_id_fkey"
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
    const idxName = table === "Appointment" ? "Appointment_unit_id_idx" : "idx_appointments_unit"
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${idxName} ON ${q}(unit_id);`)
  }

  if (needsCommissionPct) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE ${q} ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2);`
    )
  }
  if (needsCommissionAmt) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE ${q} ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2);`
    )
  }

  unitColumnReadyCache = true
}

/** Tabela de linhas de serviço por agendamento (Prisma `AppointmentServiceLine`). */
export async function ensureAppointmentServiceLinesTableReady(): Promise<void> {
  const apptTable = await getAppointmentsTableName()
  const apptQ = quoteTable(apptTable)
  const svcTable = await getServicesTableName()
  const svcQ = quoteTable(svcTable)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS appointment_service_lines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID NOT NULL REFERENCES ${apptQ}(id) ON DELETE CASCADE,
      service_id UUID NOT NULL REFERENCES ${svcQ}(id) ON DELETE RESTRICT,
      quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(10, 2) NOT NULL
    );
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS appointment_service_lines_appointment_id_idx
      ON appointment_service_lines(appointment_id);
  `)
}

export async function ensureAppointmentDbSchemaReady(): Promise<void> {
  await ensureAppointmentsUnitSchemaReady()
  await ensureAppointmentServiceLinesTableReady()
  await ensureBarbersUnitSchemaReadyOnce()
  await ensureClientsUnitSchemaReady()
}

function ensureAppointmentDbSchemaReadyOnce(): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureAppointmentDbSchemaReady().catch((e) => {
      schemaReadyPromise = null
      throw e
    })
  }
  return schemaReadyPromise
}

/**
 * Agendamentos sem `unit_id`: copia a unidade do profissional (SQL — não depende do Prisma enxergar a coluna).
 */
export async function syncAppointmentUnitsFromBarbers(barbershopId: string): Promise<void> {
  const apptTable = await getAppointmentsTableName()
  if (!(await appointmentsTableHasColumn(apptTable, "unit_id"))) return

  let barberTable = getPrismaModelTableName("Barber")
  if (!(await tableExists(barberTable))) {
    barberTable = (await tableExists("barbers")) ? "barbers" : barberTable
  }
  if (!(await appointmentsTableHasColumn(barberTable, "unit_id"))) return

  const apptQ = quoteTable(apptTable)
  const barberQ = quoteTable(barberTable)

  await prisma.$executeRaw(
    Prisma.sql`UPDATE ${Prisma.raw(apptQ)} AS a
      SET unit_id = b.unit_id
      FROM ${Prisma.raw(barberQ)} AS b
      WHERE a.barber_id = b.id
        AND a.barbershop_id = ${barbershopId}::uuid
        AND a.unit_id IS NULL
        AND b.unit_id IS NOT NULL`
  )
}

export async function withAppointmentDbSchema<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await ensureAppointmentDbSchemaReadyOnce()
    return await fn()
  } catch (e) {
    if (isAppointmentSchemaError(e)) {
      invalidateAppointmentSchemaCache()
      schemaReadyPromise = null
      await ensureAppointmentDbSchemaReady()
      schemaReadyPromise = Promise.resolve()
      return await fn()
    }
    throw e
  }
}
