import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

function isStaleClientDescriptionError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  return e.message.includes("Unknown argument") && e.message.includes("description")
}

/** Atualiza só a coluna description (compatível com Prisma Client gerado antes do campo existir). */
async function setServiceDescriptionRow(serviceId: string, text: string): Promise<void> {
  const desc = text.slice(0, 2000)
  try {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE services SET description = ${desc} WHERE id = ${serviceId}::uuid`
    )
  } catch {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "Service" SET description = ${desc} WHERE id = ${serviceId}::uuid`
    )
  }
}

type CreateArgs = {
  barbershopId: string
  name: string
  description: string
  price: number
  duration: number
  active?: boolean
}

export async function prismaServiceCreateWithDescription(args: CreateArgs) {
  const active = args.active ?? true
  const duration = Math.max(1, args.duration || 30)
  const desc = args.description.trim().slice(0, 2000)

  try {
    return await prisma.service.create({
      data: {
        barbershopId: args.barbershopId,
        name: args.name,
        description: desc,
        price: args.price,
        duration,
        active,
      },
    })
  } catch (e) {
    if (!isStaleClientDescriptionError(e)) throw e
    const row = await prisma.service.create({
      data: {
        barbershopId: args.barbershopId,
        name: args.name,
        price: args.price,
        duration,
        active,
      },
    })
    if (desc) await setServiceDescriptionRow(row.id, desc)
    return prisma.service.findUniqueOrThrow({ where: { id: row.id } })
  }
}

type PatchArgs = {
  id: string
  barbershopId: string
  name?: string
  description?: string
  price?: number
  duration?: number
  active?: boolean
}

export async function prismaServicePatchWithOptionalDescription(args: PatchArgs) {
  const { id, barbershopId } = args

  const prismaData: {
    name?: string
    description?: string
    price?: number
    duration?: number
    active?: boolean
  } = {}
  if (args.name !== undefined) prismaData.name = args.name.trim()
  if (args.price !== undefined) prismaData.price = Number(args.price)
  if (args.duration !== undefined) prismaData.duration = Math.max(1, Number(args.duration) || 30)
  if (args.active !== undefined) prismaData.active = Boolean(args.active)

  const desc =
    args.description !== undefined ? String(args.description).trim().slice(0, 2000) : undefined

  const hasDesc = desc !== undefined
  const hasOther = Object.keys(prismaData).length > 0

  if (hasDesc) {
    try {
      return await prisma.service.update({
        where: { id },
        data: { ...prismaData, description: desc },
      })
    } catch (e) {
      if (!isStaleClientDescriptionError(e)) throw e
      if (hasOther) {
        await prisma.service.update({ where: { id }, data: prismaData })
      }
      await setServiceDescriptionRow(id, desc)
      return prisma.service.findFirstOrThrow({ where: { id, barbershopId } })
    }
  }

  return prisma.service.update({ where: { id }, data: prismaData })
}
