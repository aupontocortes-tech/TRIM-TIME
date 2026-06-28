import type { AsaasCreditCardHolderInput } from "@/lib/asaas/card-types"
import {
  confirmSandboxAsaasPayment,
  getAsaasPayment,
  listAllSubscriptionPayments,
  listSubscriptionPayments,
  payAsaasPaymentWithCreditCard,
  tokenizeAsaasCreditCard,
  type AsaasBillingType,
  type AsaasPayment,
} from "@/lib/asaas/client"
import { isAsaasSandboxApi, isAsaasConfigured } from "@/lib/asaas/config"
import type { SubscriptionPlan } from "@/lib/db/types"
import { onBarbershopPlanChanged } from "@/lib/barbershop-units-plan"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

const PAID_ASAAS_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"])

const PAID_LOCAL_STATUSES = new Set([
  "CONFIRMED",
  "RECEIVED",
  "RECEIVED_IN_CASH",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
])

function isPaidAsaasStatus(status: string): boolean {
  return PAID_ASAAS_STATUSES.has(status.trim().toUpperCase())
}

function isCardBilling(billingType?: AsaasBillingType | string | null): boolean {
  const bt = (billingType ?? "").trim().toUpperCase()
  return bt === "CREDIT_CARD" || bt === "DEBIT_CARD"
}

function isPendingAsaasStatus(status: string): boolean {
  const s = status.trim().toUpperCase()
  return s === "PENDING" || s === "AWAITING_RISK_ANALYSIS" || s === "OVERDUE"
}

/** Cartão fictício documentado pelo Asaas sandbox. */
const SANDBOX_TEST_CARD = {
  holderName: "SANDBOX TESTE",
  number: "5162306219378829",
  expiryMonth: "12",
  expiryYear: "2030",
  ccv: "318",
}

async function resolveSandboxFakeCardPaymentInput(barbershopId: string): Promise<{
  creditCardToken: string
  remoteIp: string
  creditCardHolderInfo: AsaasCreditCardHolderInput
} | null> {
  if (!isAsaasSandboxApi()) return null

  const sub = await prisma.subscription.findUnique({
    where: { barbershopId },
    include: { barbershop: { select: { name: true, email: true, phone: true } } },
  })
  if (!sub?.asaasCustomerId || !sub.barbershop) return null

  const creditCardHolderInfo: AsaasCreditCardHolderInput = {
    name: sub.barbershop.name.slice(0, 80) || "SANDBOX TESTE",
    email: sub.barbershop.email,
    cpfCnpj: "24971563792",
    postalCode: "01310100",
    addressNumber: "100",
    phone: sub.barbershop.phone?.replace(/\D/g, "") || "11999999999",
  }

  try {
    const token = await tokenizeAsaasCreditCard({
      customerId: sub.asaasCustomerId,
      creditCard: SANDBOX_TEST_CARD,
      creditCardHolderInfo,
      remoteIp: "127.0.0.1",
    })
    return {
      creditCardToken: token.creditCardToken,
      remoteIp: "127.0.0.1",
      creditCardHolderInfo,
    }
  } catch (e) {
    console.warn("[sandbox] tokenize fake card", barbershopId, e)
    return null
  }
}

/** Sandbox: confirma cobrança (API confirm → payWithCreditCard → cartão fake de teste). */
export async function tryConfirmSandboxBarbershopPayment(params: {
  barbershopId: string
  paymentId: string
  billingType?: AsaasBillingType
  creditCardToken?: string
  remoteIp?: string
  creditCardHolderInfo?: AsaasCreditCardHolderInput
}): Promise<AsaasPayment | null> {
  let confirmed = await tryAutoConfirmSandboxCreditCardPayment(params.paymentId, params.billingType)

  if (!confirmed && params.creditCardToken && params.remoteIp && params.creditCardHolderInfo) {
    confirmed = await tryPayWithCreditCardToken(params.paymentId, {
      creditCardToken: params.creditCardToken,
      remoteIp: params.remoteIp,
      creditCardHolderInfo: params.creditCardHolderInfo,
    })
  }

  if (!confirmed) {
    const fake = await resolveSandboxFakeCardPaymentInput(params.barbershopId)
    if (fake) {
      confirmed = await tryPayWithCreditCardToken(params.paymentId, fake)
    }
  }

  return confirmed
}

/** Sandbox: confirma pagamento via API (sem abrir painel Asaas). */
export async function tryAutoConfirmSandboxCreditCardPayment(
  paymentId: string,
  billingType?: AsaasBillingType
): Promise<AsaasPayment | null> {
  if (!isAsaasSandboxApi()) return null
  if (billingType && !isCardBilling(billingType)) return null

  try {
    let payment = await getAsaasPayment(paymentId)

    const isCard =
      isCardBilling(billingType) ||
      isCardBilling(payment.billingType) ||
      !!payment.subscription

    if (!isCard) return null
    if (isPaidAsaasStatus(payment.status)) return payment
    if (!isPendingAsaasStatus(payment.status)) return null

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 + attempt * 400))
        payment = await confirmSandboxAsaasPayment(paymentId)
        if (isPaidAsaasStatus(payment.status)) return payment
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn("[sandbox] confirm attempt", attempt + 1, paymentId, msg)
      }
    }

    payment = await getAsaasPayment(paymentId)
    return isPaidAsaasStatus(payment.status) ? payment : null
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn("[sandbox] auto-confirm payment failed", paymentId, msg)
    return null
  }
}

export async function waitForSubscriptionPendingPayment(
  subscriptionId: string,
  attempts = 12
): Promise<AsaasPayment | null> {
  for (let i = 0; i < attempts; i++) {
    for (const status of ["PENDING", "OVERDUE"] as const) {
      const rows = await listSubscriptionPayments(subscriptionId, status)
      if (rows[0]) return rows[0]
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 700))
    }
  }
  const all = await listAllSubscriptionPayments(subscriptionId, "10")
  return all.find((p) => isPendingAsaasStatus(p.status ?? "")) ?? null
}

async function tryPayWithCreditCardToken(
  paymentId: string,
  input?: {
    creditCardToken: string
    remoteIp: string
    creditCardHolderInfo: AsaasCreditCardHolderInput
  }
): Promise<AsaasPayment | null> {
  if (!input?.creditCardToken) return null
  try {
    const paid = await payAsaasPaymentWithCreditCard(paymentId, input)
    return isPaidAsaasStatus(paid.status) ? paid : null
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn("[sandbox] payWithCreditCard failed", paymentId, msg)
    return null
  }
}

function paymentMetadata(
  base: Record<string, unknown>,
  extra?: Record<string, unknown>
): Prisma.InputJsonValue {
  return { ...base, ...extra } as Prisma.InputJsonValue
}

export async function syncBarbershopPaymentFromAsaas(params: {
  barbershopId: string
  payment: AsaasPayment
  plan: SubscriptionPlan
  asaasSubscriptionId: string
  billingType?: AsaasBillingType
  metadata?: Record<string, unknown>
}): Promise<void> {
  const paid = isPaidAsaasStatus(params.payment.status)
  const localStatus = paid ? "CONFIRMED" : params.payment.status

  const existing = await prisma.payment.findFirst({
    where: { provider: "asaas", externalId: params.payment.id },
  })

  const prevMeta =
    existing?.metadata &&
    typeof existing.metadata === "object" &&
    !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {}

  if (existing) {
    const statusToWrite = paid ? "CONFIRMED" : params.payment.status

    await prisma.payment.update({
      where: { id: existing.id },
      data: {
        status: statusToWrite,
        amount: params.payment.value,
        plan: params.plan,
        metadata: paymentMetadata(prevMeta, params.metadata),
      },
    })
  } else {
    await prisma.payment.create({
      data: {
        barbershopId: params.barbershopId,
        provider: "asaas",
        externalId: params.payment.id,
        amount: params.payment.value,
        status: localStatus,
        plan: params.plan,
        metadata: paymentMetadata(
          {
            billingType: params.billingType,
            subscriptionId: params.asaasSubscriptionId,
          },
          params.metadata
        ),
      },
    })
  }

  if (paid) {
    const nextPayment = new Date()
    nextPayment.setMonth(nextPayment.getMonth() + 1)
    await prisma.subscription.update({
      where: { barbershopId: params.barbershopId },
      data: {
        status: "active",
        plan: params.plan,
        trialEnd: null,
        nextPayment,
        asaasSubscriptionId: params.asaasSubscriptionId,
      },
    })
    await onBarbershopPlanChanged(params.barbershopId, params.plan)
  }
}

export async function autoConfirmAndSyncSubscriptionPayment(params: {
  barbershopId: string
  paymentId: string
  plan: SubscriptionPlan
  asaasSubscriptionId: string
  billingType: AsaasBillingType
  creditCardToken?: string
  remoteIp?: string
  creditCardHolderInfo?: AsaasCreditCardHolderInput
}): Promise<AsaasPayment | null> {
  let charged: AsaasPayment | null = null

  if (isAsaasSandboxApi()) {
    charged = await tryConfirmSandboxBarbershopPayment({
      barbershopId: params.barbershopId,
      paymentId: params.paymentId,
      billingType: params.billingType,
      creditCardToken: params.creditCardToken,
      remoteIp: params.remoteIp,
      creditCardHolderInfo: params.creditCardHolderInfo,
    })
  } else if (
    isCardBilling(params.billingType) &&
    params.creditCardToken &&
    params.remoteIp &&
    params.creditCardHolderInfo
  ) {
    charged = await tryPayWithCreditCardToken(params.paymentId, {
      creditCardToken: params.creditCardToken,
      remoteIp: params.remoteIp,
      creditCardHolderInfo: params.creditCardHolderInfo,
    })
  }

  const payment = charged ?? (await getAsaasPayment(params.paymentId).catch(() => null))
  if (!payment) return null

  await syncBarbershopPaymentFromAsaas({
    barbershopId: params.barbershopId,
    payment,
    plan: params.plan,
    asaasSubscriptionId: params.asaasSubscriptionId,
    billingType: params.billingType,
    metadata: {
      sandbox_auto_confirm: !!charged && isAsaasSandboxApi(),
      production_card_charge: !!charged && !isAsaasSandboxApi(),
    },
  })
  return payment
}

async function resolvePaymentSyncContext(
  row: {
    barbershopId: string
    metadata: unknown
  },
  asaasPayment?: AsaasPayment | null
): Promise<{ billingType: AsaasBillingType; asaasSubscriptionId: string }> {
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}

  let billingType = (meta.billingType as AsaasBillingType | undefined) ?? "CREDIT_CARD"
  let asaasSubscriptionId = typeof meta.subscriptionId === "string" ? meta.subscriptionId : ""

  if (!asaasSubscriptionId || !meta.billingType) {
    const sub = await prisma.subscription.findUnique({
      where: { barbershopId: row.barbershopId },
      select: { asaasSubscriptionId: true, billingType: true },
    })
    if (!asaasSubscriptionId) asaasSubscriptionId = sub?.asaasSubscriptionId ?? ""
    if (!meta.billingType && sub?.billingType) {
      billingType = sub.billingType as AsaasBillingType
    }
  }

  if (asaasPayment?.subscription && !asaasSubscriptionId) {
    asaasSubscriptionId = asaasPayment.subscription
  }
  if (isCardBilling(asaasPayment?.billingType) && !isCardBilling(billingType)) {
    billingType = asaasPayment!.billingType
  }

  return { billingType, asaasSubscriptionId }
}

export async function autoConfirmPendingSubscriptionPayments(params: {
  barbershopId: string
  asaasSubscriptionId: string
  plan: SubscriptionPlan
  billingType: AsaasBillingType
  creditCardToken?: string
  remoteIp?: string
  creditCardHolderInfo?: AsaasCreditCardHolderInput
}): Promise<void> {
  if (!isCardBilling(params.billingType)) return

  const pending = await waitForSubscriptionPendingPayment(params.asaasSubscriptionId)
  if (!pending) return

  await autoConfirmAndSyncSubscriptionPayment({
    barbershopId: params.barbershopId,
    paymentId: pending.id,
    plan: params.plan,
    asaasSubscriptionId: params.asaasSubscriptionId,
    billingType: params.billingType,
    creditCardToken: params.creditCardToken,
    remoteIp: params.remoteIp,
    creditCardHolderInfo: params.creditCardHolderInfo,
  })
}

/** Importa cobranças da assinatura Asaas que ainda não estão no banco local. */
export async function importSubscriptionPaymentsFromAsaas(barbershopId: string): Promise<number> {
  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })
  if (!sub?.asaasSubscriptionId || !sub.plan) return 0

  const billingType = (sub.billingType ?? "CREDIT_CARD") as AsaasBillingType
  const payments = await listAllSubscriptionPayments(sub.asaasSubscriptionId, "15")
  let imported = 0

  for (const payment of payments) {
    const paid = isPaidAsaasStatus(payment.status)
    const localStatus = paid ? "CONFIRMED" : payment.status
    const existing = await prisma.payment.findFirst({
      where: { provider: "asaas", externalId: payment.id },
    })

    if (existing) {
      await prisma.payment.update({
        where: { id: existing.id },
        data: {
          status: localStatus,
          amount: payment.value,
          plan: sub.plan as SubscriptionPlan,
        },
      })
      continue
    }

    await prisma.payment.create({
      data: {
        barbershopId,
        provider: "asaas",
        externalId: payment.id,
        amount: payment.value,
        status: localStatus,
        plan: sub.plan as SubscriptionPlan,
        metadata: paymentMetadata(
          { billingType, subscriptionId: sub.asaasSubscriptionId },
          { imported_from_asaas: true }
        ),
      },
    })
    imported++
  }

  return imported
}

/** Sincroniza cobranças pendentes de uma barbearia (checkout / cadastro de cartão). */
export async function syncBarbershopPendingPayments(barbershopId: string): Promise<number> {
  await importSubscriptionPaymentsFromAsaas(barbershopId).catch((e) => {
    console.warn("[billing] import subscription payments", barbershopId, e)
  })

  if (!isAsaasSandboxApi()) {
    const rows = await prisma.payment.findMany({
      where: {
        barbershopId,
        provider: "asaas",
        externalId: { not: null },
        status: { in: ["PENDING", "OVERDUE"] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    let synced = 0
    for (const row of rows) {
      if (!row.externalId || !row.plan) continue
      try {
        const payment = await getAsaasPayment(row.externalId)
        if (!isPaidAsaasStatus(payment.status)) continue
        const ctx = await resolvePaymentSyncContext(row, payment)
        await syncBarbershopPaymentFromAsaas({
          barbershopId,
          payment,
          plan: row.plan as SubscriptionPlan,
          asaasSubscriptionId: ctx.asaasSubscriptionId,
          billingType: ctx.billingType,
          metadata: { synced_from_asaas: true },
        })
        synced++
      } catch (e) {
        console.warn("[billing] sync production payment", row.id, e)
      }
    }
    return synced
  }

  const rows = await prisma.payment.findMany({
    where: {
      barbershopId,
      provider: "asaas",
      externalId: { not: null },
      status: { in: ["PENDING", "OVERDUE"] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  let synced = 0
  for (const row of rows) {
    if (!row.externalId || !row.plan) continue

    try {
      const ctx = await resolvePaymentSyncContext(row)
      const result = await autoConfirmAndSyncSubscriptionPayment({
        barbershopId,
        paymentId: row.externalId,
        plan: row.plan as SubscriptionPlan,
        asaasSubscriptionId: ctx.asaasSubscriptionId,
        billingType: ctx.billingType,
      })
      if (result && isPaidAsaasStatus(result.status)) synced++
    } catch (e) {
      console.warn("[sandbox] sync barbershop payment", row.id, e)
    }
  }
  return synced
}

/** Atualiza cobranças pendentes no Financeiro (super admin). */
export async function syncPendingSandboxPaymentsFromDb(limit = 50): Promise<number> {
  if (!isAsaasConfigured()) return 0

  const subs = await prisma.subscription.findMany({
    where: { asaasSubscriptionId: { not: null } },
    select: { barbershopId: true },
    take: 15,
  })
  for (const s of subs) {
    await importSubscriptionPaymentsFromAsaas(s.barbershopId).catch(() => {})
  }

  if (!isAsaasSandboxApi()) return 0

  const rows = await prisma.payment.findMany({
    where: {
      provider: "asaas",
      externalId: { not: null },
      status: {
        in: [
          "PENDING",
          "OVERDUE",
          "RECEIVED_IN_CASH",
          "CONFIRMED",
          "RECEIVED",
          "PAYMENT_CONFIRMED",
          "PAYMENT_RECEIVED",
        ],
      },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  })

  let synced = 0
  for (const row of rows) {
    if (!row.externalId || !row.plan) continue

    try {
      const asaasPayment = await getAsaasPayment(row.externalId)
      const ctx = await resolvePaymentSyncContext(row, asaasPayment)
      const localNorm = row.status.trim().toUpperCase()
      const asaasPaid = isPaidAsaasStatus(asaasPayment.status)
      const localPaid = PAID_LOCAL_STATUSES.has(localNorm)

      if (asaasPaid) {
        await syncBarbershopPaymentFromAsaas({
          barbershopId: row.barbershopId,
          payment: asaasPayment,
          plan: row.plan as SubscriptionPlan,
          asaasSubscriptionId: ctx.asaasSubscriptionId,
          billingType: ctx.billingType,
          metadata: { synced_from_admin: true },
        })
        synced++
        continue
      }

      if (localPaid || isPendingAsaasStatus(asaasPayment.status)) {
        await syncBarbershopPaymentFromAsaas({
          barbershopId: row.barbershopId,
          payment: asaasPayment,
          plan: row.plan as SubscriptionPlan,
          asaasSubscriptionId: ctx.asaasSubscriptionId,
          billingType: ctx.billingType,
          metadata: { synced_from_admin: true },
        })
      }

      if (
        !isCardBilling(ctx.billingType) &&
        !isCardBilling(asaasPayment.billingType) &&
        !asaasPayment.subscription
      ) {
        continue
      }

      if (!isPendingAsaasStatus(asaasPayment.status)) continue

      const confirmed = await autoConfirmAndSyncSubscriptionPayment({
        barbershopId: row.barbershopId,
        paymentId: row.externalId,
        plan: row.plan as SubscriptionPlan,
        asaasSubscriptionId: ctx.asaasSubscriptionId,
        billingType: isCardBilling(asaasPayment.billingType) ? asaasPayment.billingType : ctx.billingType,
      })
      if (confirmed && isPaidAsaasStatus(confirmed.status)) synced++
    } catch (e) {
      console.warn("[sandbox] sync pending payment", row.id, e)
    }
  }

  return synced
}
