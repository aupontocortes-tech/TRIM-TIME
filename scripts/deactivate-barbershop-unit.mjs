/**
 * Desativa unidade órfã/de teste no slug informado (não apaga do banco).
 * Uso: node scripts/deactivate-barbershop-unit.mjs adm ADM2
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

const slug = process.argv[2]?.trim()
const unitName = process.argv[3]?.trim()
if (!slug || !unitName) {
  console.error("Uso: node scripts/deactivate-barbershop-unit.mjs <slug> <nome-unidade>")
  process.exit(1)
}

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error("DATABASE_URL ausente em .env.local")
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

const shop = await prisma.barbershop.findUnique({
  where: { slug },
  select: { id: true, name: true },
})
if (!shop) {
  console.error(`Barbearia não encontrada: ${slug}`)
  process.exit(1)
}

const unit = await prisma.barbershopUnit.findFirst({
  where: { barbershopId: shop.id, name: unitName },
})
if (!unit) {
  console.error(`Unidade "${unitName}" não encontrada em ${slug}`)
  process.exit(1)
}

await prisma.barbershopUnit.update({
  where: { id: unit.id },
  data: { active: false },
})

console.log(`OK: unidade "${unitName}" desativada em /b/${slug} (id=${unit.id})`)
await prisma.$disconnect()
