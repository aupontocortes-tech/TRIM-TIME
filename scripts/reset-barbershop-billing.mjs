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
const trialEndYmd = trialEnd.toISOString().slice(0, 10)

function getAsaasApiBaseUrl() {
  const env = process.env.ASAAS_ENVIRONMENT?.trim().toLowerCase()
  return env === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3"
}

function isOpenAsaasPaymentStatus(status) {
  const s = String(status ?? "").trim().toUpperCase()
  return s === "PENDING" || s === "OVERDUE" || s === "AWAITING_RISK_ANALYSIS"
}

async function asaasFetch(path, init) {
  const key = process.env.ASAAS_API_KEY?.trim()
  if (!key) return null
  const url = new URL(`${getAsaasApiBaseUrl()}${path}`)
  if (init?.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) url.searchParams.set(k, v)
  }
  const { searchParams: _s, ...rest } = init ?? {}
  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      access_token: key,
      ...(rest.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      body?.errors?.map((e) => e.description).filter(Boolean).join("; ") ||
      body?.message ||
      `Asaas HTTP ${res.status}`
    throw new Error(msg)
  }
  return body
}

let asaasPaymentsDeleted = 0
if (keepCard && sub?.asaasSubscriptionId && process.env.ASAAS_API_KEY?.trim()) {
  try {
    const list = await asaasFetch(`/subscriptions/${sub.asaasSubscriptionId}/payments`, {
      searchParams: { limit: "30" },
    })
    for (const p of list?.data ?? []) {
      if (!isOpenAsaasPaymentStatus(p.status)) continue
      await asaasFetch(`/payments/${p.id}`, { method: "DELETE" }).catch(() => {})
      asaasPaymentsDeleted++
    }
    await asaasFetch(`/subscriptions/${sub.asaasSubscriptionId}`, {
      method: "PUT",
      body: JSON.stringify({
        value: 39,
        billingType: sub.billingType ?? "CREDIT_CARD",
        nextDueDate: trialEndYmd,
        updatePendingPayments: true,
      }),
    })
  } catch (e) {
    console.warn("[reset] limpeza Asaas:", e instanceof Error ? e.message : e)
  }
} else if (keepCard && sub?.asaasSubscriptionId && !process.env.ASAAS_API_KEY?.trim()) {
  console.warn(
    "\nAVISO: ASAAS_API_KEY ausente no .env.local — só o banco foi resetado.\n" +
      "Ao abrir Assinatura no site, cobranças pendentes do Asaas podem voltar.\n" +
      "Copie ASAAS_API_KEY da Vercel → .env.local e rode o script de novo.\n"
  )
}

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
    ...(keepCard
      ? {}
      : {
          cardSetupAt: null,
          asaasCustomerId: null,
          asaasSubscriptionId: null,
          asaasPixAutomaticAuthId: null,
          billingType: null,
        }),
  },
})

console.log("\n=== Billing reset ===")
console.log("Barbearia:", bs.name, `(${bs.slug})`, bs.email)
console.log("Cobranças locais apagadas:", deleted.count)
console.log("Cobranças abertas apagadas no Asaas:", asaasPaymentsDeleted)
console.log("Cartão mantido:", keepCard && !!sub?.cardSetupAt ? "sim" : "não")
console.log("Assinatura: trial Pro até", trialEnd.toISOString())
console.log(
  keepCard
    ? "\nEntre na barbearia → Assinatura → escolha Pro → Contratar plano (cobrança integral)."
    : "\nFaça login na barbearia e cadastre o cartão de novo."
)

await prisma.$disconnect()
