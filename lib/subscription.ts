/**
 * Lógica de assinatura e trial - Trim Time SaaS
 */

import type { Barbershop, Subscription, SubscriptionPlan, SubscriptionStatus } from "@/lib/db/types"
import { TRIAL_DAYS } from "@/lib/plans"

/** Se `true` ou `1`, todas as barbearias tratam plano efetivo como Premium (desenvolvimento). Desligue em produção com pagamento real. */
export function isUnlockAllPlanFeaturesEnv(): boolean {
  const v = process.env.TRIMTIME_UNLOCK_ALL_PLAN_FEATURES?.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

export function isTrialActive(subscription: Subscription | null): boolean {
  if (!subscription || subscription.status !== "trial") return false
  if (!subscription.trial_end) return false
  return new Date(subscription.trial_end) > new Date()
}

export function getEffectivePlan(subscription: Subscription | null): SubscriptionPlan | null {
  if (!subscription) return null
  if (subscription.status === "trial") return "premium" // trial é sempre premium
  if (subscription.status === "active" || subscription.status === "past_due") return subscription.plan
  return null
}

/** Plano efetivo para limites e `hasFeature`: super_admin, conta teste, env, trial/assinatura. */
export function getEffectivePlanForBarbershop(
  barbershop: { role?: string; is_test?: boolean; name?: string | null } | null,
  subscription: Subscription | null
): SubscriptionPlan | null {
  const normalizedName = (barbershop?.name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
  const isNamedFullAccess =
    normalizedName === "auto cortes" || normalizedName === "bsb thiago lins"

  if (isUnlockAllPlanFeaturesEnv()) return "premium"
  if (barbershop?.role === "super_admin") return "premium"
  if (barbershop?.is_test === true) return "premium"
  if (isNamedFullAccess) return "premium"
  return getEffectivePlan(subscription)
}

export function daysLeftInTrial(subscription: Subscription | null): number {
  if (!subscription?.trial_end || subscription.status !== "trial") return 0
  const end = new Date(subscription.trial_end)
  const now = new Date()
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

export function shouldPromptPlanChoice(subscription: Subscription | null): boolean {
  if (!subscription) return true
  if (subscription.status === "trial" && !isTrialActive(subscription)) return true
  if (subscription.status === "canceled" || subscription.status === "past_due") return true
  return false
}

export function createTrialEndDate(): Date {
  const end = new Date()
  end.setDate(end.getDate() + TRIAL_DAYS)
  return end
}
