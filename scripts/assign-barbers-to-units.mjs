/**
 * Vincula barbeiros sem unidade à unidade onde mais atenderam (útil com 2+ lojas).
 * Uso: node scripts/assign-barbers-to-units.mjs [slug]
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const slug = process.argv[2]?.trim()

async function main() {
  const shop = slug
    ? await prisma.barbershop.findUnique({ where: { slug }, select: { id: true, name: true } })
    : null

  const barbers = await prisma.barber.findMany({
    where: {
      unitId: null,
      ...(shop ? { barbershopId: shop.id } : {}),
    },
    select: { id: true, name: true, barbershopId: true },
  })

  if (barbers.length === 0) {
    console.log("Nenhum barbeiro sem unidade.")
    return
  }

  const fallbackByShop = new Map()
  let updated = 0
  for (const b of barbers) {
    let fallback = fallbackByShop.get(b.barbershopId)
    if (!fallback) {
      fallback = await prisma.barbershopUnit.findFirst({
        where: { barbershopId: b.barbershopId, active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      })
      if (!fallback) continue
      fallbackByShop.set(b.barbershopId, fallback)
    }
    await prisma.barber.update({ where: { id: b.id }, data: { unitId: fallback.id } })
    console.log(`${b.name} → ${fallback.name}`)
    updated++
  }

  console.log(`Atualizados: ${updated}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
