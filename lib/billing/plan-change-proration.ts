import type { SubscriptionPlan } from "@/lib/db/types"
import { getPlanCatalog } from "@/lib/plan-catalog"
import { prisma } from "@/lib/prisma"

const PLAN_ORDER: Record<SubscriptionPlan, number> = {
  basic: 1,
  pro: 2,
  premium: 3,
}

const PAID_STATUSES = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]

export type PlanChangeBilling = {
  chargeMode: "full" | "difference" | "none"
  chargeAmount: number
  nextSubscriptionValue: number
  updatePendingPayments: boolean
  fromPlan: SubscriptionPlan
  toPlan: SubscriptionPlan
  reason: string
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function startOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

async function hasPaidPlanThisMonth(barbershopId: string): Promise<boolean> {
  const row = await prisma.payment.findFirst({
    where: {
      barbershopId,
      provider: "asaas",
      status: { in: PAID_STATUSES },
      createdAt: { gte: startOfCurrentMonth() },
    },
    select: { id: true },
  })
  return !!row
}

/**
 * Regras de troca de plano no mesmo mês:
 * - Upgrade (ex.: Básico → Pro): cobra só a diferença de preço se já pagou no mês.
 * - Downgrade: muda o plano na assinatura; próxima fatura já vem no valor menor (sem cobrança extra agora).
 * - Sem pagamento no mês: cobrança integral do novo plano (fluxo normal Asaas).
 */
export async function computePlanChangeBilling(
  barbershopId: string,
  currentPlan: SubscriptionPlan,
  newPlan: SubscriptionPlan
): Promise<PlanChangeBilling> {
  const catalog = await getPlanCatalog()
  const oldPrice = catalog.plans[currentPlan].price
  const newPrice = catalog.plans[newPlan].price

  if (currentPlan === newPlan) {
    return {
      chargeMode: "none",
      chargeAmount: 0,
      nextSubscriptionValue: newPrice,
      updatePendingPayments: false,
      fromPlan: currentPlan,
      toPlan: newPlan,
      reason: "same_plan",
    }
  }

  if (PLAN_ORDER[newPlan] < PLAN_ORDER[currentPlan]) {
    return {
      chargeMode: "none",
      chargeAmount: 0,
      nextSubscriptionValue: newPrice,
      updatePendingPayments: false,
      fromPlan: currentPlan,
      toPlan: newPlan,
      reason: "downgrade_next_invoice",
    }
  }

  const paidThisMonth = await hasPaidPlanThisMonth(barbershopId)
  if (paidThisMonth) {
    const diff = roundMoney(newPrice - oldPrice)
    if (diff <= 0) {
      return {
        chargeMode: "none",
        chargeAmount: 0,
        nextSubscriptionValue: newPrice,
        updatePendingPayments: false,
        fromPlan: currentPlan,
        toPlan: newPlan,
        reason: "upgrade_no_difference",
      }
    }
    return {
      chargeMode: "difference",
      chargeAmount: diff,
      nextSubscriptionValue: newPrice,
      updatePendingPayments: false,
      fromPlan: currentPlan,
      toPlan: newPlan,
      reason: "upgrade_difference_same_month",
    }
  }

  return {
    chargeMode: "full",
    chargeAmount: newPrice,
    nextSubscriptionValue: newPrice,
    updatePendingPayments: true,
    fromPlan: currentPlan,
    toPlan: newPlan,
    reason: "upgrade_full_charge",
  }
}
