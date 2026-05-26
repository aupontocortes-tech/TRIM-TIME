import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/db/types"
import { markCardSetupComplete } from "@/lib/asaas/billing-service"
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
}

const ACTIVE_PAYMENT = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH",
])

const OVERDUE_PAYMENT = new Set(["PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED"])

const CANCEL_SUB = new Set([
  "SUBSCRIPTION_DELETED",
  "SUBSCRIPTION_INACTIVATED",
])

const CARD_SETUP_EVENTS = new Set([
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "SUBSCRIPTION_CREATED",
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

export async function handleAsaasWebhook(payload: WebhookPayload): Promise<void> {
  const event = payload.event ?? ""
  const payment = payload.payment

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
