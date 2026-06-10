/**
 * Garante uma unidade pelo nome (ex.: ADM2) sem apagar dados existentes.
 * Uso: node scripts/ensure-barbershop-unit.mjs --shop ADM --unit ADM2
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : null
}

const shopName = arg("--shop")?.trim()
const unitName = arg("--unit")?.trim()

if (!shopName || !unitName) {
  console.error("Uso: node scripts/ensure-barbershop-unit.mjs --shop NOME_BARBEARIA --unit NOME_UNIDADE")
  process.exit(1)
}

try {
  const shop = await prisma.barbershop.findFirst({
    where: { name: { equals: shopName, mode: "insensitive" } },
    select: { id: true, name: true },
  })
  if (!shop) {
    console.error(`Barbearia não encontrada: ${shopName}`)
    process.exit(1)
  }

  const existing = await prisma.barbershopUnit.findFirst({
    where: { barbershopId: shop.id, name: { equals: unitName, mode: "insensitive" } },
  })

  if (existing) {
    if (!existing.active) {
      await prisma.barbershopUnit.update({
        where: { id: existing.id },
        data: { active: true },
      })
      console.log(`Unidade "${unitName}" reativada (id ${existing.id}).`)
    } else {
      console.log(`Unidade "${unitName}" já existe e está ativa (id ${existing.id}).`)
    }
    process.exit(0)
  }

  const row = await prisma.barbershopUnit.create({
    data: {
      barbershopId: shop.id,
      name: unitName,
      active: true,
    },
  })
  console.log(`Unidade "${unitName}" criada para "${shop.name}" (id ${row.id}).`)
  console.log("Revincule barbeiros/clientes da filial em Configurações → Equipe / Clientes.")
} finally {
  await prisma.$disconnect()
}
