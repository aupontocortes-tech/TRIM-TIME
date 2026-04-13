import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Nome físico da tabela varia: migrações SQL usam `barbers`; `prisma db push` sem @@map costuma criar `"Barber"`.
 */
async function setBarberPhotoPositionRow(barberId: string, pos: number): Promise<void> {
  try {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE barbers SET photo_position = ${pos} WHERE id = ${barberId}::uuid`
    )
  } catch (e1) {
    try {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE "Barber" SET photo_position = ${pos} WHERE id = ${barberId}::uuid`
      )
    } catch (e2) {
      throw e2 instanceof Error ? e2 : e1 instanceof Error ? e1 : new Error("Falha ao gravar posição da foto")
    }
  }
}

export type BarberCreateWithPositionInput = {
  barbershopId: string
  name: string
  phone: string
  email: string | null
  cpf: string | null
  photoUrl: string | null
  photoPosition: number
  commission: number
  active: boolean
}

/**
 * Atualiza barbeiro: nunca envia `photoPosition` ao Prisma (evita client desatualizado / drift).
 * A posição do recorte é sempre gravada com SQL na coluna `photo_position`.
 */
export async function prismaBarberUpdateWithPhotoPositionFallback(
  id: string,
  data: Prisma.BarberUpdateInput
) {
  const pos = data.photoPosition
  const { photoPosition: _omit, ...rest } = data
  const restKeys = Object.keys(rest).filter((k) => (rest as Record<string, unknown>)[k] !== undefined)
  if (restKeys.length > 0) {
    await prisma.barber.update({ where: { id }, data: rest })
  }
  if (typeof pos === "number" && !Number.isNaN(pos)) {
    await setBarberPhotoPositionRow(id, pos)
  }
  return prisma.barber.findUniqueOrThrow({ where: { id } })
}

export async function prismaBarberCreateWithPhotoPositionFallback(input: BarberCreateWithPositionInput) {
  const { photoPosition, ...rest } = input
  const row = await prisma.barber.create({ data: rest })
  await setBarberPhotoPositionRow(row.id, photoPosition)
  return prisma.barber.findUniqueOrThrow({ where: { id: row.id } })
}
