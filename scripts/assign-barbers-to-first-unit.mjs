/**
 * Vincula barbeiros à primeira unidade (ou unidade pelo nome).
 * Uso:
 *   node scripts/assign-barbers-to-first-unit.mjs adm
 *   node scripts/assign-barbers-to-first-unit.mjs adm ADM
 *   node scripts/assign-barbers-to-first-unit.mjs adm ADM --only-orphans
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

const slug = process.argv[2]?.trim()
const unitNameArg = process.argv[3]?.trim()
const onlyOrphans = process.argv.includes("--only-orphans")

if (!slug) {
  console.error("Uso: node scripts/assign-barbers-to-first-unit.mjs <slug> [nome-unidade] [--only-orphans]")
  process.exit(1)
}

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error("DATABASE_URL ausente em .env.local")
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

async function main() {
  const shop = await prisma.barbershop.findUnique({
    where: { slug },
    select: { id: true, name: true, email: true },
  })
  if (!shop) {
    console.error(`Barbearia não encontrada: ${slug}`)
    process.exit(1)
  }

  const units = await prisma.barbershopUnit.findMany({
    where: { barbershopId: shop.id, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, createdAt: true },
  })

  if (units.length === 0) {
    console.error("Nenhuma unidade ativa.")
    process.exit(1)
  }

  const target =
    (unitNameArg
      ? units.find((u) => u.name.trim().toLowerCase() === unitNameArg.trim().toLowerCase())
      : null) ?? units[0]

  const where = {
    barbershopId: shop.id,
    ...(onlyOrphans ? { unitId: null } : {}),
  }

  const barbers = await prisma.barber.findMany({
    where,
    select: { id: true, name: true, unitId: true },
    orderBy: { name: "asc" },
  })

  if (barbers.length === 0) {
    console.log(onlyOrphans ? "Nenhum barbeiro sem unidade." : "Nenhum barbeiro.")
    return
  }

  const result = await prisma.barber.updateMany({
    where: { id: { in: barbers.map((b) => b.id) } },
    data: { unitId: target.id },
  })

  console.log(`Barbearia: ${shop.name} (${slug})`)
  console.log(`Unidade alvo: ${target.name} (${target.id})`)
  console.log(`Modo: ${onlyOrphans ? "só sem unidade" : "todos os profissionais"}`)
  console.log(`Atualizados: ${result.count}`)
  for (const b of barbers) {
    const from = b.unitId ? b.unitId.slice(0, 8) + "…" : "null"
    console.log(`  - ${b.name} (${from} → ${target.name})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
