import {
  confirmSandboxAsaasPayment,
  getAsaasPayment,
  listAllSubscriptionPayments,
  listSubscriptionPayments,
  type AsaasBillingType,
  type AsaasPayment,
} from "@/lib/asaas/client"
import { isAsaasSandboxApi } from "@/lib/asaas/config"
import type { SubscriptionPlan } from "@/lib/db/types"
import { onBarbershopPlanChanged } from "@/lib/barbershop-units-plan"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

const PAID_ASAAS_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"])

function isPaidAsaasStatus(status: string): boolean {
  return PAID_ASAAS_STATUSES.has(status.trim().toUpperCase())
}

function isCardBilling(billingType?: AsaasBillingType | string | null): boolean {
  const bt = (billingType ?? "").trim().toUpperCase()
  return bt === "CREDIT_CARD" || bt === "DEBIT_CARD"
}

function isPendingAsaasStatus(status: string): boolean {
  const s = status.trim().toUpperCase()
  return s === "PENDING" || s === "AWAITING_RISK_ANALYSIS"
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

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        payment = await confirmSandboxAsaasPayment(paymentId)
        if (isPaidAsaasStatus(payment.status)) return payment
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn("[sandbox] confirm attempt", attempt + 1, paymentId, msg)
        if (attempt < 2) await new Promise((r) => setTimeout(r, 800))
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
  attempts = 10
): Promise<AsaasPayment | null> {
  for (let i = 0; i < attempts; i++) {
    const pending = await listSubscriptionPayments(subscriptionId, "PENDING")
    if (pending[0]) return pending[0]
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 700))
    }
  }
  const all = await listAllSubscriptionPayments(subscriptionId, "5")
  return all.find((p) => isPendingAsaasStatus(p.status ?? "")) ?? null
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
    await prisma.payment.update({
      where: { id: existing.id },
      data: {
        status: localStatus,
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
}): Promise<AsaasPayment | null> {
  const confirmed = await tryAutoConfirmSandboxCreditCardPayment(params.paymentId, params.billingType)
  const payment = confirmed ?? (await getAsaasPayment(params.paymentId).catch(() => null))
  if (!payment) return null

  await syncBarbershopPaymentFromAsaas({
    barbershopId: params.barbershopId,
    payment,
    plan: params.plan,
    asaasSubscriptionId: params.asaasSubscriptionId,
    billingType: params.billingType,
    metadata: { sandbox_auto_confirm: !!confirmed },
  })
  return payment
}

export async function autoConfirmPendingSubscriptionPayments(params: {
  barbershopId: string
  asaasSubscriptionId: string
  plan: SubscriptionPlan
  billingType: AsaasBillingType
}): Promise<void> {
  if (!isAsaasSandboxApi() || !isCardBilling(params.billingType)) return

  const pending = await waitForSubscriptionPendingPayment(params.asaasSubscriptionId)
  if (!pending) return

  await autoConfirmAndSyncSubscriptionPayment({
    barbershopId: params.barbershopId,
    paymentId: pending.id,
    plan: params.plan,
    asaasSubscriptionId: params.asaasSubscriptionId,
    billingType: params.billingType,
  })
}

/** Sincroniza cobranças pendentes de uma barbearia (checkout / cadastro de cartão). */
export async function syncBarbershopPendingPayments(barbershopId: string): Promise<number> {
  if (!isAsaasSandboxApi()) return 0

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
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {}
    const billingType = (meta.billingType as AsaasBillingType | undefined) ?? "CREDIT_CARD"
    const subId = typeof meta.subscriptionId === "string" ? meta.subscriptionId : ""

    try {
      const result = await autoConfirmAndSyncSubscriptionPayment({
        barbershopId,
        paymentId: row.externalId,
        plan: row.plan as SubscriptionPlan,
        asaasSubscriptionId: subId,
        billingType,
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
  if (!isAsaasSandboxApi()) return 0

  const rows = await prisma.payment.findMany({
    where: {
      provider: "asaas",
      externalId: { not: null },
      status: { in: ["PENDING", "OVERDUE", "RECEIVED_IN_CASH", "CONFIRMED", "RECEIVED"] },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  })

  let synced = 0
  for (const row of rows) {
    if (!row.externalId || !row.plan) continue

    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {}
    const billingType = (meta.billingType as AsaasBillingType | undefined) ?? "CREDIT_CARD"
    const subId = typeof meta.subscriptionId === "string" ? meta.subscriptionId : ""

    try {
      const asaasPayment = await getAsaasPayment(row.externalId)
      const asaasSubId = subId || asaasPayment.subscription || ""

      if (isPaidAsaasStatus(asaasPayment.status)) {
        await syncBarbershopPaymentFromAsaas({
          barbershopId: row.barbershopId,
          payment: asaasPayment,
          plan: row.plan as SubscriptionPlan,
          asaasSubscriptionId: asaasSubId,
          billingType,
          metadata: { synced_from_admin: true },
        })
        synced++
        continue
      }

      if (!isCardBilling(billingType) && !isCardBilling(asaasPayment.billingType) && !asaasPayment.subscription) {
        continue
      }

      const confirmed = await autoConfirmAndSyncSubscriptionPayment({
        barbershopId: row.barbershopId,
        paymentId: row.externalId,
        plan: row.plan as SubscriptionPlan,
        asaasSubscriptionId: asaasSubId,
        billingType: isCardBilling(asaasPayment.billingType) ? asaasPayment.billingType : billingType,
      })
      if (confirmed && isPaidAsaasStatus(confirmed.status)) synced++
    } catch (e) {
      console.warn("[sandbox] sync pending payment", row.id, e)
    }
  }

  return synced
}
