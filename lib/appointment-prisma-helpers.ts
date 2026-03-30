/**
 * Serialização Prisma → formato snake_case usado pelas rotas / UI (legado Supabase).
 */
import type { Prisma } from "@prisma/client"
import type { Appointment, Barber, Client, Service } from "@/lib/db/types"
import type { AppointmentStatus } from "@/lib/db/types"

export const appointmentApiInclude = {
  client: true,
  barber: true,
  service: true,
} satisfies Prisma.AppointmentInclude

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: typeof appointmentApiInclude
}>

export function parseAppointmentDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) throw new Error("Data inválida")
  return new Date(Date.UTC(y, m - 1, d))
}

function formatAppointmentDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function mapClient(c: NonNullable<AppointmentWithRelations["client"]>): Client {
  return {
    id: c.id,
    barbershop_id: c.barbershopId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    cpf: c.cpf ?? null,
    photo_url: c.photoUrl ?? null,
    loyalty_points: c.loyaltyPoints,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  }
}

function mapBarber(b: NonNullable<AppointmentWithRelations["barber"]>): Barber {
  return {
    id: b.id,
    barbershop_id: b.barbershopId,
    name: b.name,
    phone: b.phone,
    email: b.email ?? null,
    cpf: b.cpf ?? null,
    photo_url: b.photoUrl ?? null,
    commission: Number(b.commission),
    active: b.active,
    role: b.role as Barber["role"],
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  }
}

function mapService(s: NonNullable<AppointmentWithRelations["service"]>): Service {
  return {
    id: s.id,
    barbershop_id: s.barbershopId,
    name: s.name,
    price: Number(s.price),
    duration: s.duration,
    active: s.active,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  }
}

export function mapAppointmentRowToApi(row: AppointmentWithRelations): Appointment {
  return {
    id: row.id,
    barbershop_id: row.barbershopId,
    client_id: row.clientId,
    barber_id: row.barberId,
    service_id: row.serviceId,
    date: formatAppointmentDate(row.date),
    time: row.time,
    status: row.status as AppointmentStatus,
    total_price: row.totalPrice != null ? Number(row.totalPrice) : null,
    commission_percent: row.commissionPercent != null ? Number(row.commissionPercent) : null,
    commission_amount: row.commissionAmount != null ? Number(row.commissionAmount) : null,
    unit_id: row.unitId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    client: row.client ? mapClient(row.client) : undefined,
    barber: row.barber ? mapBarber(row.barber) : undefined,
    service: row.service ? mapService(row.service) : undefined,
  }
}
