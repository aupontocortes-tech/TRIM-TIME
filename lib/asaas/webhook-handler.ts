import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/db/types"
import { cancelSubscriptionKeepingCard, markCardSetupComplete } from "@/lib/asaas/billing-service"
import { getAsaasPayment } from "@/lib/asaas/client"
import { prisma } from "@/lib/prisma"

type WebhookPayload = {
  event?: string
  payment?: {
    id?: string
    customer?: string
    subscription?: string
    status?: string
    value?: number
    externalReference?: string
  }
  authorization?: {
    id?: string
    status?: string
    customerId?: string
    subscriptionId?: string
    value?: number
  }
  paymentInstruction?: {
    id?: string
    status?: string
    payment?: string
    authorization?: { id?: string }
  }
}

const ACTIVE_PAYMENT = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH",
])

const OVERDUE_PAYMENT = new Set(["PAYMENT_OVERDUE", "PAYMENT_DELETED"])
const REFUND_PAYMENT = new Set(["PAYMENT_REFUNDED"])

const CANCEL_SUB = new Set([
  "SUBSCRIPTION_DELETED",
  "SUBSCRIPTION_INACTIVATED",
])

const CARD_SETUP_EVENTS = new Set([
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "SUBSCRIPTION_CREATED",
])

const PIX_AUTH_CANCELLED = new Set([
  "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED",
  "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED",
  "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED",
])

function planFromExternalRef(ref: string | undefined): SubscriptionPlan | null {
  if (!ref) return null
  const part = ref.split(":").pop()
  if (part === "basic" || part === "pro" || part === "premium") return part
  return null
}

async function findSubscriptionByAsaas(
  asaasSubscriptionId: string | undefined,
  asaasCustomerId: string | undefined,
  externalReference: string | undefined
) {
  if (asaasSubscriptionId) {
    const bySub = await prisma.subscription.findFirst({
      where: { asaasSubscriptionId },
    })
    if (bySub) return bySub
  }
  if (asaasCustomerId) {
    const byCust = await prisma.subscription.findFirst({
      where: { asaasCustomerId },
    })
    if (byCust) return byCust
  }
  const barbershopId = externalReference?.split(":")[0]
  if (barbershopId) {
    return prisma.subscription.findUnique({ where: { barbershopId } })
  }
  return null
}

async function findSubscriptionByPixAuth(
  authId: string | undefined,
  customerId: string | undefined
) {
  if (authId) {
    const byAuth = await prisma.subscription.findFirst({
      where: { asaasPixAutomaticAuthId: authId },
    })
    if (byAuth) return byAuth
  }
  if (customerId) {
    return prisma.subscription.findFirst({ where: { asaasCustomerId: customerId } })
  }
  return null
}

async function handlePixAutomaticWebhook(payload: WebhookPayload): Promise<void> {
  const event = payload.event ?? ""
  const auth = payload.authorization
  const authId = auth?.id ?? payload.paymentInstruction?.authorization?.id

  if (event === "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED" && auth) {
    const sub = await findSubscriptionByPixAuth(auth.id, auth.customerId)
    if (sub) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          asaasPixAutomaticAuthId: auth.id ?? sub.asaasPixAutomaticAuthId,
          asaasSubscriptionId: auth.subscriptionId ?? sub.asaasSubscriptionId,
          asaasCustomerId: auth.customerId ?? sub.asaasCustomerId,
          billingType: "PIX",
        },
      })
    }
    return
  }

  if (PIX_AUTH_CANCELLED.has(event)) {
    const sub = await findSubscriptionByPixAuth(authId, auth?.customerId)
    if (sub) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: "canceled" satisfies SubscriptionStatus,
          nextPayment: null,
          asaasPixAutomaticAuthId: null,
        },
      })
    }
  }
}

export async function handleAsaasWebhook(payload: WebhookPayload): Promise<void> {
  const event = payload.event ?? ""
  const payment = payload.payment

  if (event.startsWith("PIX_AUTOMATIC_")) {
    await handlePixAutomaticWebhook(payload)
    if (!payment?.id) return
  }

  if (CARD_SETUP_EVENTS.has(event) && payment?.subscription) {
    const subRow = await findSubscriptionByAsaas(
      payment.subscription,
      payment.customer,
      payment.externalReference
    )
    if (subRow?.status === "trial" && !subRow.cardSetupAt) {
      await markCardSetupComplete(subRow.barbershopId)
    }
  }

  if (CANCEL_SUB.has(event) && payment?.subscription) {
    const sub = await findSubscriptionByAsaas(payment.subscription, payment.customer, undefined)
    if (sub) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: "canceled" satisfies SubscriptionStatus,
          nextPayment: null,
          asaasSubscriptionId: null,
        },
      })
    }
    return
  }

  if (!payment?.id) return

  let fullPayment = payment
  try {
    fullPayment = await getAsaasPayment(payment.id)
  } catch {
    /* use webhook body */
  }

  const sub = await findSubscriptionByAsaas(
    fullPayment.subscription,
    fullPayment.customer,
    (fullPayment as { externalReference?: string }).externalReference
  )
  if (!sub) return

  const extRef = (fullPayment as { externalReference?: string }).externalReference ?? ""
  if (
    extRef.endsWith(":card_setup") ||
    extRef.includes(":card_setup") ||
    extRef.endsWith(":trial_auto") ||
    extRef.includes(":trial_auto")
  ) {
    await markCardSetupComplete(sub.barbershopId)
    return
  }

  const planFromRef = planFromExternalRef(
    (fullPayment as { externalReference?: string }).externalReference
  )
  const plan = planFromRef ?? sub.plan

  if (ACTIVE_PAYMENT.has(event)) {
    const nextPayment = new Date()
    nextPayment.setMonth(nextPayment.getMonth() + 1)
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: "active",
        plan,
        trialEnd: null,
        nextPayment,
        asaasSubscriptionId: fullPayment.subscription ?? sub.asaasSubscriptionId,
        asaasCustomerId: fullPayment.customer ?? sub.asaasCustomerId,
      },
    })
    const existingPay = await prisma.payment.findFirst({
      where: { provider: "asaas", externalId: fullPayment.id },
    })
    if (existingPay) {
      await prisma.payment.update({
        where: { id: existingPay.id },
        data: { status: "CONFIRMED", plan, metadata: { event } },
      })
    } else {
      await prisma.payment.create({
        data: {
          barbershopId: sub.barbershopId,
          provider: "asaas",
          externalId: fullPayment.id,
          amount: fullPayment.value ?? 0,
          status: "CONFIRMED",
          plan,
          metadata: { event },
        },
      })
    }
    return
  }

  if (REFUND_PAYMENT.has(event) && fullPayment.id) {
    const existingPay = await prisma.payment.findFirst({
      where: { provider: "asaas", externalId: fullPayment.id },
    })
    if (existingPay) {
      const prevMeta =
        existingPay.metadata &&
        typeof existingPay.metadata === "object" &&
        !Array.isArray(existingPay.metadata)
          ? (existingPay.metadata as Record<string, unknown>)
          : {}
      await prisma.payment.update({
        where: { id: existingPay.id },
        data: {
          status: "REFUNDED",
          metadata: { ...prevMeta, event, refunded_at: new Date().toISOString() },
        },
      })
    } else {
      await prisma.payment.create({
        data: {
          barbershopId: sub.barbershopId,
          provider: "asaas",
          externalId: fullPayment.id,
          amount: fullPayment.value ?? 0,
          status: "REFUNDED",
          plan: sub.plan,
          metadata: { event },
        },
      }).catch(() => {})
    }
    await cancelSubscriptionKeepingCard(sub.barbershopId)
    return
  }

  if (OVERDUE_PAYMENT.has(event)) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "past_due" },
    })
    if (fullPayment.id) {
      await prisma.payment.create({
        data: {
          barbershopId: sub.barbershopId,
          provider: "asaas",
          externalId: fullPayment.id,
          amount: fullPayment.value ?? 0,
          status: fullPayment.status ?? event,
          plan: sub.plan,
          metadata: { event },
        },
      }).catch(() => {})
    }
  }
}
