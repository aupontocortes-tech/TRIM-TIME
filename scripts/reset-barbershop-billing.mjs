/**
 * Apaga cobranças locais e reinicia assinatura para testar contratação do zero.
 * Uso:
 *   node scripts/reset-barbershop-billing.mjs teste
 *   node scripts/reset-barbershop-billing.mjs teste --keep-card
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

const args = process.argv.slice(2)
const query = args.find((a) => !a.startsWith("--"))?.trim()
const keepCard = args.includes("--keep-card")

if (!query) {
  console.error("Uso: node scripts/reset-barbershop-billing.mjs <nome-ou-slug> [--keep-card]")
  process.exit(1)
}

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error("DATABASE_URL ausente em .env.local")
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

const bs = await prisma.barbershop.findFirst({
  where: {
    OR: [
      { name: { equals: query, mode: "insensitive" } },
      { slug: { equals: query, mode: "insensitive" } },
    ],
  },
  select: { id: true, name: true, email: true, slug: true },
})

if (!bs) {
  console.error(`Barbearia não encontrada: "${query}"`)
  process.exit(1)
}

const sub = await prisma.subscription.findUnique({
  where: { barbershopId: bs.id },
  select: {
    cardSetupAt: true,
    asaasCustomerId: true,
    asaasSubscriptionId: true,
    billingType: true,
  },
})

const deleted = await prisma.payment.deleteMany({ where: { barbershopId: bs.id } })

const trialEnd = new Date()
trialEnd.setDate(trialEnd.getDate() + 7)

await prisma.subscription.upsert({
  where: { barbershopId: bs.id },
  create: {
    barbershopId: bs.id,
    plan: "pro",
    status: "trial",
    trialEnd,
    ...(keepCard && sub?.cardSetupAt ? { cardSetupAt: sub.cardSetupAt } : {}),
    ...(keepCard && sub?.asaasCustomerId ? { asaasCustomerId: sub.asaasCustomerId } : {}),
    ...(keepCard && sub?.asaasSubscriptionId
      ? { asaasSubscriptionId: sub.asaasSubscriptionId }
      : {}),
    ...(keepCard && sub?.billingType ? { billingType: sub.billingType } : {}),
  },
  update: {
    plan: "pro",
    status: "trial",
    trialEnd,
    nextPayment: null,
    postTrialChoice: null,
    graceAccessUntil: null,
    ...(keepCard ? {} : { cardSetupAt: null }),
  },
})

console.log("\n=== Billing reset ===")
console.log("Barbearia:", bs.name, `(${bs.slug})`, bs.email)
console.log("Cobranças apagadas:", deleted.count)
console.log("Cartão mantido:", keepCard && !!sub?.cardSetupAt ? "sim" : "não")
console.log("Assinatura: trial Pro até", trialEnd.toISOString())
console.log(
  keepCard
    ? "\nEntre na barbearia → Assinatura → escolha Pro → Contratar plano (cobrança integral)."
    : "\nFaça login na barbearia e cadastre o cartão de novo."
)

await prisma.$disconnect()
