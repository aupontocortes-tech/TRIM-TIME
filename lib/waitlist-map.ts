import type { Prisma } from "@prisma/client"
import type { Barber, Client, Service, WaitingListItem, WaitingListStatus } from "@/lib/db/types"
import { parseExtraServiceIds } from "@/lib/waitlist-service"

export const waitlistApiInclude = {
  client: true,
  barber: true,
  service: true,
} satisfies Prisma.WaitingListItemInclude

export type WaitingListRow = Prisma.WaitingListItemGetPayload<{
  include: typeof waitlistApiInclude
}>

function ymdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function mapClient(c: NonNullable<WaitingListRow["client"]>): Client {
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

function mapBarber(b: NonNullable<WaitingListRow["barber"]>): Barber {
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

function mapService(s: NonNullable<WaitingListRow["service"]>): Service {
  return {
    id: s.id,
    barbershop_id: s.barbershopId,
    name: s.name,
    description: s.description ?? "",
    price: Number(s.price),
    duration: s.duration,
    active: s.active,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  }
}

export function mapWaitingListRowToApi(row: WaitingListRow): WaitingListItem {
  const extra = parseExtraServiceIds(row.extraServiceIds as Prisma.JsonValue)
  return {
    id: row.id,
    barbershop_id: row.barbershopId,
    client_id: row.clientId,
    barber_id: row.barberId,
    service_id: row.serviceId,
    extra_service_ids: extra,
    desired_date: row.desiredDate ? ymdLocal(row.desiredDate) : null,
    desired_time: row.desiredTime ? row.desiredTime.slice(0, 5) : null,
    preferred_period: row.preferredPeriod ?? null,
    priority: row.priority,
    status: row.status as WaitingListStatus,
    notified_at: row.notifiedAt?.toISOString() ?? null,
    accepted_at: row.acceptedAt?.toISOString() ?? null,
    offered_date: row.offeredDate ? ymdLocal(row.offeredDate) : null,
    offered_time: row.offeredTime ? row.offeredTime.slice(0, 5) : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    client: row.client ? mapClient(row.client) : undefined,
    barber: row.barber ? mapBarber(row.barber) : undefined,
    service: row.service ? mapService(row.service) : undefined,
  }
}
