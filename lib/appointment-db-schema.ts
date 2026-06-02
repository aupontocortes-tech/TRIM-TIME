import { prisma } from "@/lib/prisma"
import { ensureBarbersUnitSchemaReadyOnce } from "@/lib/barber-unit-schema"

let schemaReadyPromise: Promise<void> | null = null

function isMissingAppointmentColumnError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    (msg.includes("does not exist") || msg.includes("(not available)")) &&
    (msg.includes("unit_id") ||
      msg.includes("unitId") ||
      msg.includes("appointment_service_lines") ||
      msg.includes("photo_scale") ||
      msg.includes("photo_position"))
  )
}

/** Coluna `unit_id` em agendamentos (migração 004). */
export async function ensureAppointmentsUnitSchemaReady(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS unit_id UUID;
  `)

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'appointments_unit_id_fkey'
      ) THEN
        ALTER TABLE appointments
          ADD CONSTRAINT appointments_unit_id_fkey
          FOREIGN KEY (unit_id) REFERENCES barbershop_units(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_appointments_unit ON appointments(unit_id);
  `)
}

/** Tabela de linhas de serviço por agendamento (Prisma `AppointmentServiceLine`). */
export async function ensureAppointmentServiceLinesTableReady(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS appointment_service_lines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
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
    if (isMissingAppointmentColumnError(e)) {
      schemaReadyPromise = null
      await ensureAppointmentDbSchemaReady()
      schemaReadyPromise = Promise.resolve()
      return await fn()
    }
    throw e
  }
}
