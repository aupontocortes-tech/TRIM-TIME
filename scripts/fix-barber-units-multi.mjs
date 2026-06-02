/**
 * Corrige equipe em barbearias com 2+ unidades: só orfãos (unit_id null) vão para a 1ª loja.
 * Uso: node scripts/fix-barber-units-multi.mjs [slug-da-barbearia]
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error("DATABASE_URL ausente em .env.local")
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
const slug = process.argv[2]?.trim()

async function main() {
  const shop = slug
    ? await prisma.barbershop.findUnique({ where: { slug }, select: { id: true, name: true } })
    : null

  const shops = shop
    ? [shop]
    : await prisma.barbershop.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })

  for (const s of shops) {
    const units = await prisma.barbershopUnit.findMany({
      where: { barbershopId: s.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, active: true },
    })
    if (units.length <= 1) {
      console.log(`[${s.name}] Uma unidade — nada a fazer.`)
      continue
    }

    const principalId = units[0].id
    const barbers = await prisma.barber.findMany({
      where: { barbershopId: s.id },
      select: { id: true, name: true, unitId: true },
      orderBy: { name: "asc" },
    })

    const orphans = barbers.filter((b) => !b.unitId)
    if (orphans.length > 0) {
      await prisma.barber.updateMany({
        where: { barbershopId: s.id, unitId: null },
        data: { unitId: principalId },
      })
      console.log(`[${s.name}] ${orphans.length} profissional(is) sem unidade → "${units[0].name}"`)
    }

    console.log(`[${s.name}] Unidades:`)
    for (const u of units) {
      const n = barbers.filter((b) => b.unitId === u.id || (!b.unitId && u.id === principalId)).length
      const assigned = await prisma.barber.count({
        where: { barbershopId: s.id, unitId: u.id },
      })
      console.log(`  - ${u.name} (${u.active ? "ativa" : "inativa"}): ${assigned} na equipe`)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
