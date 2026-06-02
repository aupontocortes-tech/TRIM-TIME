import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ensureBarbersUnitSchemaReadyOnce } from "@/lib/barber-unit-schema"

let schemaReadyPromise: Promise<void> | null = null
let resolvedAppointmentsTable: string | null = null
let resolvedServicesTable: string | null = null

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
        msg.includes("appointment_service_lines") ||
        msg.includes("photo_scale") ||
        msg.includes("photo_position")))
  )
}

/** Nome físico: migrações SQL usam `appointments`; `prisma db push` costuma criar `"Appointment"`. */
async function getAppointmentsTableName(): Promise<string> {
  if (resolvedAppointmentsTable) return resolvedAppointmentsTable

  const rows = await prisma.$queryRaw<{ table_name: string }[]>(Prisma.sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('appointments', 'Appointment')
    LIMIT 1
  `)

  if (rows[0]?.table_name) {
    resolvedAppointmentsTable = rows[0].table_name
    return resolvedAppointmentsTable
  }

  try {
    await prisma.$queryRaw(Prisma.sql`SELECT 1 FROM appointments LIMIT 1`)
    resolvedAppointmentsTable = "appointments"
  } catch {
    resolvedAppointmentsTable = "Appointment"
  }
  return resolvedAppointmentsTable
}

function quoteAppointmentsTable(name: string): string {
  return name === "Appointment" ? '"Appointment"' : "appointments"
}

async function getServicesTableName(): Promise<string> {
  if (resolvedServicesTable) return resolvedServicesTable

  const rows = await prisma.$queryRaw<{ table_name: string }[]>(Prisma.sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('services', 'Service')
    LIMIT 1
  `)

  if (rows[0]?.table_name) {
    resolvedServicesTable = rows[0].table_name
    return resolvedServicesTable
  }

  resolvedServicesTable = "services"
  return resolvedServicesTable
}

function quoteServicesTable(name: string): string {
  return name === "Service" ? '"Service"' : "services"
}

async function appointmentsTableHasColumn(table: string, columnName: string): Promise<boolean> {
  const tableName = table === "Appointment" ? "Appointment" : "appointments"
  try {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${tableName}
          AND column_name = ${columnName}
      ) AS "exists"
    `)
    return !!rows[0]?.exists
  } catch {
    return false
  }
}

/** Coluna `unit_id` em agendamentos (migração 004). */
export async function ensureAppointmentsUnitSchemaReady(): Promise<void> {
  const table = await getAppointmentsTableName()
  const q = quoteAppointmentsTable(table)

  const hasUnitId = await appointmentsTableHasColumn(table, "unit_id")
  if (hasUnitId) return

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

/** Tabela de linhas de serviço por agendamento (Prisma `AppointmentServiceLine`). */
export async function ensureAppointmentServiceLinesTableReady(): Promise<void> {
  const apptTable = await getAppointmentsTableName()
  const apptQ = quoteAppointmentsTable(apptTable)
  const svcTable = await getServicesTableName()
  const svcQ = quoteServicesTable(svcTable)

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
 * Agendamentos antigos sem `unit_id`: copia a unidade do profissional (ex.: ADM2).
 */
export async function syncAppointmentUnitsFromBarbers(barbershopId: string): Promise<void> {
  const table = await getAppointmentsTableName()
  const hasUnitId = await appointmentsTableHasColumn(table, "unit_id")
  if (!hasUnitId) return

  const rows = await prisma.appointment.findMany({
    where: {
      barbershopId,
      unitId: null,
      barber: { unitId: { not: null } },
    },
    select: { id: true, barber: { select: { unitId: true } } },
    take: 500,
  })
  if (!rows.length) return

  await Promise.all(
    rows.map((row) =>
      prisma.appointment.update({
        where: { id: row.id },
        data: { unitId: row.barber.unitId },
      })
    )
  )
}

export async function withAppointmentDbSchema<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await ensureAppointmentDbSchemaReadyOnce()
    return await fn()
  } catch (e) {
    if (isAppointmentSchemaError(e)) {
      resolvedAppointmentsTable = null
      resolvedServicesTable = null
      schemaReadyPromise = null
      await ensureAppointmentDbSchemaReady()
      schemaReadyPromise = Promise.resolve()
      return await fn()
    }
    throw e
  }
}
