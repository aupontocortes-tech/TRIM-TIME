import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { Appointment } from "@/lib/db/types"

/** Linha lida direto do Postgres (independe do Prisma Client conhecer o campo `description`). */
export type ServiceDbRow = {
  id: string
  barbershop_id: string
  name: string
  description: string
  price: unknown
  duration: number
  active: boolean
  created_at: Date
  updated_at: Date
}

export function serviceDbRowToApi(s: ServiceDbRow) {
  return {
    id: s.id,
    barbershop_id: s.barbershop_id,
    name: s.name,
    description: (s.description ?? "").trim(),
    price: Number(s.price),
    duration: s.duration,
    active: s.active,
    created_at: s.created_at.toISOString(),
    updated_at: s.updated_at.toISOString(),
  }
}

type FetchOpts = {
  activeOnly?: boolean
  orderBy: "name" | "created_at"
}

async function selectServicesFrom(
  table: "services" | "Service",
  barbershopId: string,
  opts: FetchOpts
): Promise<ServiceDbRow[]> {
  const activeClause = opts.activeOnly ? Prisma.sql`AND active = true` : Prisma.empty
  const order =
    opts.orderBy === "name"
      ? Prisma.sql`ORDER BY name ASC`
      : Prisma.sql`ORDER BY created_at ASC`

  if (table === "services") {
    return prisma.$queryRaw<ServiceDbRow[]>(Prisma.sql`
      SELECT
        id,
        barbershop_id,
        name,
        COALESCE(description, '')::text AS description,
        price,
        duration,
        active,
        created_at,
        updated_at
      FROM services
      WHERE barbershop_id = ${barbershopId}::uuid
      ${activeClause}
      ${order}
    `)
  }

  return prisma.$queryRaw<ServiceDbRow[]>(Prisma.sql`
    SELECT
      id,
      barbershop_id,
      name,
      COALESCE(description, '')::text AS description,
      price,
      duration,
      active,
      created_at,
      updated_at
    FROM "Service"
    WHERE barbershop_id = ${barbershopId}::uuid
    ${activeClause}
    ${order}
  `)
}

/**
 * Lista serviços com `description` sempre preenchida a partir do banco
 * (evita Prisma Client antigo omitir a coluna no SELECT).
 */
export async function fetchServicesForBarbershopRaw(
  barbershopId: string,
  opts: FetchOpts = { orderBy: "name" }
): Promise<ServiceDbRow[]> {
  try {
    return await selectServicesFrom("services", barbershopId, opts)
  } catch {
    return await selectServicesFrom("Service", barbershopId, opts)
  }
}

/** Descrições atuais no banco para vários serviços (uma query). */
export async function fetchServiceDescriptionsByIds(serviceIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(serviceIds.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const idList = Prisma.join(unique.map((id) => Prisma.sql`${id}::uuid`))

  try {
    const rows = await prisma.$queryRaw<{ id: string; description: string }[]>(Prisma.sql`
      SELECT id, COALESCE(description, '')::text AS description
      FROM services
      WHERE id IN (${idList})
    `)
    return new Map(rows.map((r) => [r.id, (r.description ?? "").trim()]))
  } catch {
    const rows = await prisma.$queryRaw<{ id: string; description: string }[]>(Prisma.sql`
      SELECT id, COALESCE(description, '')::text AS description
      FROM "Service"
      WHERE id IN (${idList})
    `)
    return new Map(rows.map((r) => [r.id, (r.description ?? "").trim()]))
  }
}

/** Garante `service.description` vinda do Postgres (útil quando o Prisma Client omite o campo). */
export async function withServiceDescriptionsFromDb(appointments: Appointment[]): Promise<Appointment[]> {
  const ids = appointments.map((a) => a.service_id).filter(Boolean)
  const descById = await fetchServiceDescriptionsByIds(ids)
  return appointments.map((api) => {
    if (!api.service) return api
    const fromDb = descById.get(api.service.id)
    if (fromDb === undefined) return api
    return { ...api, service: { ...api.service, description: fromDb } }
  })
}

export async function fetchServiceByIdRaw(serviceId: string): Promise<ServiceDbRow | null> {
  try {
    const rows = await prisma.$queryRaw<ServiceDbRow[]>(Prisma.sql`
      SELECT
        id,
        barbershop_id,
        name,
        COALESCE(description, '')::text AS description,
        price,
        duration,
        active,
        created_at,
        updated_at
      FROM services
      WHERE id = ${serviceId}::uuid
      LIMIT 1
    `)
    return rows[0] ?? null
  } catch {
    const rows = await prisma.$queryRaw<ServiceDbRow[]>(Prisma.sql`
      SELECT
        id,
        barbershop_id,
        name,
        COALESCE(description, '')::text AS description,
        price,
        duration,
        active,
        created_at,
        updated_at
      FROM "Service"
      WHERE id = ${serviceId}::uuid
      LIMIT 1
    `)
    return rows[0] ?? null
  }
}
