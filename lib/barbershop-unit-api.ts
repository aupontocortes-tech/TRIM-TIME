import type { BarbershopUnit } from "@/lib/db/types"
import type { BarbershopUnit as PrismaBarbershopUnit } from "@prisma/client"

export function barbershopUnitToApi(row: PrismaBarbershopUnit): BarbershopUnit {
  return {
    id: row.id,
    barbershop_id: row.barbershopId,
    name: row.name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    state: row.state,
    cep: row.cep,
    maps_url: row.mapsUrl,
    active: row.active,
    archived_by_user: row.archivedByUser,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
