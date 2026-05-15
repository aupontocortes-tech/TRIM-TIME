/**
 * Plano efetivo da barbearia no servidor.
 * Usa **Prisma** (Postgres) como fonte da assinatura — igual ao POST /api/subscriptions — para não divergir
 * do que o painel grava (evita lista de espera e outros gates errados quando só o cliente Supabase estava stale).
 */
import { prisma } from "@/lib/prisma"
import { getPlanSimulationOverride } from "@/lib/plan-simulation-server"
import { isPaymentApiActive } from "@/lib/platform-settings"
import {
  getEffectivePlanForBarbershop,
  isBillingExemptBarbershop,
  requiresCardSetup,
} from "@/lib/subscription"
import type {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/lib/db/types"

/**
 * Plano efetivo para o painel/API autenticadas.
 * Cookie de simulação (dev) tem prioridade; depois o plano da barbearia do tenant (assinatura + allowlists).
 */
export async function resolveEffectivePlanForActiveSession(
  tenantBarbershopId: string
): Promise<SubscriptionPlan | null> {
  const simulated = await getPlanSimulationOverride()
  if (simulated) return simulated

  return resolveEffectivePlanForBarbershop(tenantBarbershopId)
}

export async function resolveEffectivePlanForBarbershop(
  barbershopId: string
): Promise<SubscriptionPlan | null> {
  const [bs, sub, billingActive] = await Promise.all([
    prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { name: true, email: true, role: true, isTest: true },
    }),
    prisma.subscription.findUnique({
      where: { barbershopId },
      select: {
        plan: true,
        status: true,
        trialEnd: true,
        cardSetupAt: true,
        postTrialChoice: true,
      },
    }),
    isPaymentApiActive(),
  ])

  const subscription: Subscription | null = sub
    ? {
        id: "",
        barbershop_id: barbershopId,
        plan: sub.plan as SubscriptionPlan,
        status: sub.status as SubscriptionStatus,
        trial_end: sub.trialEnd?.toISOString() ?? null,
        next_payment: null,
        card_setup_at: sub.cardSetupAt?.toISOString() ?? null,
        post_trial_choice: (sub.postTrialChoice as Subscription["post_trial_choice"]) ?? null,
        created_at: "",
        updated_at: "",
      }
    : null

  const exempt = isBillingExemptBarbershop(
    bs ? { role: bs.role, is_test: bs.isTest } : null
  )

  if (subscription && !exempt && requiresCardSetup(subscription, billingActive)) {
    return null
  }

  return getEffectivePlanForBarbershop(
    bs ? { name: bs.name, email: bs.email, role: bs.role, is_test: bs.isTest } : null,
    subscription
  )
}
