import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/** Lê `photo_position` direto do Postgres (funciona mesmo com Prisma Client antigo sem o campo no model). */
export async function fetchBarberPhotoPositionsByBarbershopId(
  barbershopId: string
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const rows = await prisma.$queryRaw<{ id: string; photo_position: number }[]>(Prisma.sql`
      SELECT id, photo_position FROM barbers WHERE barbershop_id = ${barbershopId}::uuid
    `)
    for (const r of rows) map.set(r.id, Number(r.photo_position))
  } catch {
    const rows = await prisma.$queryRaw<{ id: string; photo_position: number }[]>(Prisma.sql`
      SELECT id, photo_position FROM "Barber" WHERE barbershop_id = ${barbershopId}::uuid
    `)
    for (const r of rows) map.set(r.id, Number(r.photo_position))
  }
  return map
}

/** Uma linha só — para resposta do PATCH sem varrer a equipe inteira. */
export async function fetchBarberPhotoPositionById(barberId: string): Promise<number | null> {
  try {
    const rows = await prisma.$queryRaw<{ photo_position: number }[]>(Prisma.sql`
      SELECT photo_position FROM barbers WHERE id = ${barberId}::uuid
    `)
    return rows[0] != null ? Number(rows[0].photo_position) : null
  } catch {
    const rows = await prisma.$queryRaw<{ photo_position: number }[]>(Prisma.sql`
      SELECT photo_position FROM "Barber" WHERE id = ${barberId}::uuid
    `)
    return rows[0] != null ? Number(rows[0].photo_position) : null
  }
}
