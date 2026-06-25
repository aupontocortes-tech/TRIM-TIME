/**
 * Reativa unidades desativadas pela política antiga em contas Premium.
 * Uso: node scripts/repair-policy-archived-units.mjs [slug]
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

const slugFilter = process.argv[2]?.trim()

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error("DATABASE_URL ausente")
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

const FULL_ACCESS_EMAILS = new Set(["bsbthiagolins@gmail.com"])

function hasMultiUnits(plan) {
  return plan === "premium"
}

async function getEffectivePlan(barbershop) {
  if (barbershop.role === "super_admin" || barbershop.isTest) {
    const sub = await prisma.subscription.findUnique({ where: { barbershopId: barbershop.id } })
    return sub?.plan ?? "premium"
  }
  if (FULL_ACCESS_EMAILS.has(barbershop.email.trim().toLowerCase())) return "premium"
  const sub = await prisma.subscription.findUnique({ where: { barbershopId: barbershop.id } })
  if (!sub) return null
  if (sub.status === "active" || sub.status === "past_due") return sub.plan
  return null
}

async function getPrincipalUnitId(barbershopId, barbershopName) {
  const principalName = barbershopName?.trim()
  if (principalName) {
    const match = await prisma.barbershopUnit.findFirst({
      where: { barbershopId, name: principalName },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
    if (match) return match.id
  }
  const oldest = await prisma.barbershopUnit.findFirst({
    where: { barbershopId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  return oldest?.id ?? null
}

const shops = await prisma.barbershop.findMany({
  where: slugFilter ? { slug: slugFilter } : {},
  select: { id: true, name: true, slug: true, email: true, role: true, isTest: true },
})

let total = 0
for (const shop of shops) {
  const plan = await getEffectivePlan(shop)
  if (!plan || !hasMultiUnits(plan)) continue

  const principalId = await getPrincipalUnitId(shop.id, shop.name)
  const result = await prisma.barbershopUnit.updateMany({
    where: {
      barbershopId: shop.id,
      active: false,
      archivedByUser: false,
      ...(principalId ? { id: { not: principalId } } : {}),
    },
    data: { active: true },
  })

  if (result.count > 0) {
    console.log(`OK: ${shop.slug} — ${result.count} unidade(s) reativada(s)`)
    total += result.count
  }
}

console.log(total > 0 ? `Total reativadas: ${total}` : "Nenhuma unidade precisou de reparo.")
await prisma.$disconnect()
