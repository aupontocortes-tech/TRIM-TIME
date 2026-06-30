/**
 * Garante que a barbearia Super ADM (slug adm) mantenha acesso total sem reset de cobrança.
 * Uso: node scripts/ensure-super-adm-barbershop.mjs
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

const url = process.env.DATABASE_URL?.trim()
const superEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase()
if (!url) {
  console.error("DATABASE_URL ausente")
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

const bs = await prisma.barbershop.findFirst({
  where: superEmail
    ? { OR: [{ slug: "adm" }, { email: superEmail, role: "super_admin" }] }
    : { slug: "adm" },
  select: { id: true, name: true, slug: true, email: true, role: true, isTest: true },
})

if (!bs) {
  console.error("Barbearia Super ADM (slug adm) não encontrada.")
  process.exit(1)
}

await prisma.barbershop.update({
  where: { id: bs.id },
  data: { role: "super_admin", isTest: true },
})

const sub = await prisma.subscription.findUnique({ where: { barbershopId: bs.id } })
if (sub && (sub.status !== "active" || sub.plan !== "premium")) {
  await prisma.subscription.update({
    where: { barbershopId: bs.id },
    data: {
      status: "active",
      plan: "premium",
      trialEnd: null,
      postTrialChoice: null,
      graceAccessUntil: null,
    },
  })
  console.log("Assinatura restaurada para active / premium.")
} else if (!sub) {
  await prisma.subscription.create({
    data: { barbershopId: bs.id, status: "active", plan: "premium" },
  })
  console.log("Assinatura criada: active / premium.")
} else {
  console.log("Assinatura já estava active / premium.")
}

const payments = await prisma.payment.count({ where: { barbershopId: bs.id } })
const final = await prisma.barbershop.findUnique({
  where: { id: bs.id },
  include: { subscriptions: true },
})

console.log("\n=== Super ADM barbershop ===")
console.log(JSON.stringify({ barbershop: final, paymentsCount: payments }, null, 2))

await prisma.$disconnect()
