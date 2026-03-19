/**
 * Converte Barbershop do Prisma para o formato da API (snake_case para o frontend).
 */
import type { Barbershop } from "@/lib/db/types"

type PrismaBarbershop = {
  id: string
  name: string
  email: string
  phone: string | null
  slug: string
  role: string
  suspendedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function toBarbershopApi(b: PrismaBarbershop): Barbershop {
  return {
    id: b.id,
    name: b.name,
    email: b.email,
    phone: b.phone,
    slug: b.slug,
    role: b.role as Barbershop["role"],
    suspended_at: b.suspendedAt?.toISOString() ?? null,
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  }
}
