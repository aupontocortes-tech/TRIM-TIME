import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { clampPhotoScale } from "@/lib/barber-photo-style"

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

async function setBarberPhotoScaleRow(barberId: string, scale: number): Promise<void> {
  const s = clampPhotoScale(scale)
  try {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE barbers SET photo_scale = ${s} WHERE id = ${barberId}::uuid`
    )
  } catch (e1) {
    try {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE "Barber" SET photo_scale = ${s} WHERE id = ${barberId}::uuid`
      )
    } catch (e2) {
      throw e2 instanceof Error ? e2 : e1 instanceof Error ? e1 : new Error("Falha ao gravar zoom da foto")
    }
  }
}

export type BarberCreateWithPositionInput = {
  barbershopId: string
  unitId?: string | null
  name: string
  phone: string
  email: string | null
  cpf: string | null
  photoUrl: string | null
  photoPosition: number
  photoScale: number
  commission: number
  active: boolean
  portalToken?: string | null
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
  const scale = data.photoScale
  const { photoPosition: _omitPos, photoScale: _omitScale, ...rest } = data
  const restKeys = Object.keys(rest).filter((k) => (rest as Record<string, unknown>)[k] !== undefined)
  if (restKeys.length > 0) {
    await prisma.barber.update({ where: { id }, data: rest })
  }
  if (typeof pos === "number" && !Number.isNaN(pos)) {
    await setBarberPhotoPositionRow(id, pos)
  }
  if (typeof scale === "number" && !Number.isNaN(scale)) {
    await setBarberPhotoScaleRow(id, scale)
  }
  return prisma.barber.findUniqueOrThrow({ where: { id } })
}

export async function prismaBarberCreateWithPhotoPositionFallback(input: BarberCreateWithPositionInput) {
  const { photoPosition, photoScale, portalToken, ...rest } = input
  const row = await prisma.barber.create({
    data: {
      ...rest,
      ...(portalToken ? { portalToken } : {}),
    },
  })
  await setBarberPhotoPositionRow(row.id, photoPosition)
  await setBarberPhotoScaleRow(row.id, photoScale)
  return prisma.barber.findUniqueOrThrow({ where: { id: row.id } })
}
