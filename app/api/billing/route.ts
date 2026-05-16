import { NextResponse } from "next/server"
import { isBillingEnabled } from "@/lib/asaas/billing-service"
import { getAsaasEnvironment, isAsaasConfigured } from "@/lib/asaas/config"
import {
  daysLeftInTrial,
  getEffectivePlanForBarbershop,
  hasCardSetup,
  isBillingExemptBarbershop,
  isTrialActive,
  isInPostDeclineGracePeriod,
  isTrialExpired,
  needsTrialDecision,
  requiresCardSetup,
  shouldPromptPlanChoice,
} from "@/lib/subscription"
import { getPlanCatalog } from "@/lib/plan-catalog"
import { getBarbershopIdFromRequest } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import type { Subscription } from "@/lib/db/types"

function toSubscriptionApi(sub: {
  id: string
  barbershopId: string
  plan: string
  status: string
  trialEnd: Date | null
  nextPayment: Date | null
  asaasCustomerId: string | null
  asaasSubscriptionId: string | null
  billingType: string | null
  cardSetupAt: Date | null
  postTrialChoice: string | null
  graceAccessUntil: Date | null
  createdAt: Date
  updatedAt: Date
}): Subscription & {
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
  billing_type: string | null
} {
  return {
    id: sub.id,
    barbershop_id: sub.barbershopId,
    plan: sub.plan as Subscription["plan"],
    status: sub.status as Subscription["status"],
    trial_end: sub.trialEnd?.toISOString() ?? null,
    next_payment: sub.nextPayment?.toISOString() ?? null,
    card_setup_at: sub.cardSetupAt?.toISOString() ?? null,
    post_trial_choice: (sub.postTrialChoice as Subscription["post_trial_choice"]) ?? null,
    grace_access_until: sub.graceAccessUntil?.toISOString() ?? null,
    asaas_customer_id: sub.asaasCustomerId,
    asaas_subscription_id: sub.asaasSubscriptionId,
    billing_type: sub.billingType,
    created_at: sub.createdAt.toISOString(),
    updated_at: sub.updatedAt.toISOString(),
  }
}

export async function GET() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbershop não identificada" }, { status: 401 })
    }

    const [sub, bs, catalog, billingEnabled] = await Promise.all([
      prisma.subscription.findUnique({ where: { barbershopId } }),
      prisma.barbershop.findUnique({
        where: { id: barbershopId },
        select: { role: true, isTest: true, name: true, email: true },
      }),
      getPlanCatalog(),
      isBillingEnabled(),
    ])

    const subscription = sub ? toSubscriptionApi(sub) : null
    const exempt = isBillingExemptBarbershop(
      bs ? { role: bs.role ?? undefined, is_test: bs.isTest } : null
    )
    const effectivePlan = getEffectivePlanForBarbershop(
      bs
        ? {
            role: bs.role ?? undefined,
            is_test: bs.isTest,
            name: bs.name,
            email: bs.email,
          }
        : null,
      subscription
    )
    const trialActive = isTrialActive(subscription)
    const needsPlan = exempt ? false : shouldPromptPlanChoice(subscription)
    const needsCard = exempt ? false : requiresCardSetup(subscription)
    const needsDecision = exempt ? false : needsTrialDecision(subscription)
    const inGrace = exempt ? false : isInPostDeclineGracePeriod(subscription)

    return NextResponse.json({
      subscription,
      effective_plan: effectivePlan,
      billing_exempt: exempt,
      trial_active: trialActive,
      trial_expired: isTrialExpired(subscription),
      trial_days_left: daysLeftInTrial(subscription),
      card_setup_complete: hasCardSetup(subscription),
      requires_card_setup: needsCard,
      needs_trial_decision: needsDecision,
      needs_plan_choice: needsPlan,
      in_decline_grace_period: inGrace,
      grace_access_until: subscription?.grace_access_until ?? null,
      catalog,
      billing: {
        enabled: billingEnabled,
        asaas_configured: isAsaasConfigured(),
        environment: getAsaasEnvironment(),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar billing" },
      { status: 500 }
    )
  }
}
