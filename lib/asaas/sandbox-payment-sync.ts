import {
  confirmSandboxAsaasPayment,
  getAsaasPayment,
  listSubscriptionPayments,
  type AsaasBillingType,
  type AsaasPayment,
} from "@/lib/asaas/client"
import { getAsaasEnvironment } from "@/lib/asaas/config"
import type { SubscriptionPlan } from "@/lib/db/types"
import { onBarbershopPlanChanged } from "@/lib/barbershop-units-plan"
import { prisma } from "@/lib/prisma"

const PAID_ASAAS_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"])

function isPaidAsaasStatus(status: string): boolean {
  return PAID_ASAAS_STATUSES.has(status.trim().toUpperCase())
}

function isCardBilling(billingType?: AsaasBillingType | string | null): boolean {
  const bt = (billingType ?? "").trim().toUpperCase()
  return bt === "CREDIT_CARD" || bt === "DEBIT_CARD"
}

/** Sandbox: confirma cobrança de cartão via API (sem abrir painel Asaas). */
export async function tryAutoConfirmSandboxCreditCardPayment(
  paymentId: string,
  billingType?: AsaasBillingType
): Promise<AsaasPayment | null> {
  if (getAsaasEnvironment() !== "sandbox") return null
  if (billingType && !isCardBilling(billingType)) return null

  try {
    let payment = await getAsaasPayment(paymentId)
    if (!isCardBilling(payment.billingType)) return null

    if (isPaidAsaasStatus(payment.status)) return payment

    const pending = payment.status.trim().toUpperCase()
    if (pending !== "PENDING" && pending !== "AWAITING_RISK_ANALYSIS") return null

    payment = await confirmSandboxAsaasPayment(paymentId)
    return payment
  } catch (e) {
    console.warn("[sandbox] auto-confirm payment failed", paymentId, e)
    return null
  }
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
        metadata: { ...prevMeta, ...params.metadata },
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
        metadata: {
          billingType: params.billingType,
          subscriptionId: params.asaasSubscriptionId,
          ...params.metadata,
        },
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
  const payment =
    confirmed ?? (await getAsaasPayment(params.paymentId).catch(() => null))
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
  if (getAsaasEnvironment() !== "sandbox" || !isCardBilling(params.billingType)) return

  const pending = await listSubscriptionPayments(params.asaasSubscriptionId, "PENDING")
  for (const p of pending) {
    await autoConfirmAndSyncSubscriptionPayment({
      barbershopId: params.barbershopId,
      paymentId: p.id,
      plan: params.plan,
      asaasSubscriptionId: params.asaasSubscriptionId,
      billingType: params.billingType,
    })
  }
}
