/**
 * Lógica de assinatura e trial - Trim Time SaaS
 */

import type {
  PostTrialChoice,
  Subscription,
  SubscriptionPlan,
} from "@/lib/db/types"
import { TRIAL_GRACE_DAYS_AFTER_DECLINE } from "@/lib/onboarding"
import { TRIAL_DAYS } from "@/lib/plans"

/** Super ADM ou conta de teste: sem cartão obrigatório, sem fluxo Asaas nem bloqueios de cobrança. */
export function isBillingExemptBarbershop(barbershop: { role?: string; is_test?: boolean } | null): boolean {
  return barbershop?.role === "super_admin" || barbershop?.is_test === true
}

/** Se `true` ou `1`, todas as barbearias tratam plano efetivo como Premium (desenvolvimento). */
export function isUnlockAllPlanFeaturesEnv(): boolean {
  const v = process.env.TRIMTIME_UNLOCK_ALL_PLAN_FEATURES?.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

export function isTrialActive(subscription: Subscription | null): boolean {
  if (!subscription || subscription.status !== "trial") return false
  if (!subscription.trial_end) return false
  return new Date(subscription.trial_end) > new Date()
}

export function isTrialExpired(subscription: Subscription | null): boolean {
  if (!subscription || subscription.status !== "trial") return false
  if (!subscription.trial_end) return false
  return new Date(subscription.trial_end) <= new Date()
}

export function hasCardSetup(subscription: Subscription | null): boolean {
  return !!subscription?.card_setup_at
}

/** Conta recusou contratar, mas ainda pode entrar (configurações/reativar) por alguns dias. */
export function isInPostDeclineGracePeriod(subscription: Subscription | null): boolean {
  if (!subscription || subscription.post_trial_choice !== "declined") return false
  if (!subscription.grace_access_until) return false
  return new Date(subscription.grace_access_until) > new Date()
}

export function createGraceAccessUntilDate(
  days: number = TRIAL_GRACE_DAYS_AFTER_DECLINE
): Date {
  const end = new Date()
  end.setDate(end.getDate() + Math.max(1, days))
  return end
}

/**
 * Durante o trial: cartão obrigatório para liberar o painel (exceto contas isentas).
 * Independe do Asaas estar configurado — sem gateway, a tela de assinatura explica a limitação.
 */
export function requiresCardSetup(
  subscription: Subscription | null,
  exemptFromBillingRules = false
): boolean {
  if (exemptFromBillingRules) return false
  if (!subscription || subscription.status !== "trial") return false
  if (!isTrialActive(subscription)) return false
  return !hasCardSetup(subscription)
}

/** Trial acabou, cartão já cadastrado, ainda não aceitou nem recusou contratar. */
export function needsTrialDecision(
  subscription: Subscription | null,
  exemptFromBillingRules = false
): boolean {
  if (exemptFromBillingRules) return false
  if (!subscription) return false
  if (!isTrialExpired(subscription)) return false
  if (!hasCardSetup(subscription)) return false
  if (subscription.post_trial_choice) return false
  return true
}

export function getEffectivePlan(subscription: Subscription | null): SubscriptionPlan | null {
  if (!subscription) return null

  if (subscription.status === "trial") {
    if (!isTrialActive(subscription)) return null
    if (needsTrialDecision(subscription)) return null
    return subscription.plan
  }

  if (subscription.post_trial_choice === "declined") return null
  if (subscription.status === "active" || subscription.status === "past_due") {
    return subscription.plan
  }
  return null
}

export function getEffectivePlanForBarbershop(
  barbershop: { role?: string; is_test?: boolean; name?: string | null; email?: string | null } | null,
  subscription: Subscription | null
): SubscriptionPlan | null {
  if (barbershop?.role === "super_admin" || barbershop?.is_test === true) {
    /** Plataforma não cobra conta interna nem testes: sempre o plano do banco ou premium por padrão. */
    if (!subscription) return "premium"
    return subscription.plan
  }

  /** Trial ativo: recursos do plano contratado no banco (ex.: Pro), sem premium “oculto” por e-mail/nome. */
  if (subscription?.status === "trial" && isTrialActive(subscription)) {
    if (isUnlockAllPlanFeaturesEnv()) return "premium"
    return subscription.plan
  }

  const normalizedName = (barbershop?.name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
  const normalizedNameCompact = normalizedName.replace(/[^a-z0-9]+/g, " ").trim()
  const normalizedEmail = (barbershop?.email ?? "").trim().toLowerCase()

  const namedFullAccessPatterns = [/^auto\s*cortes?$/i, /^bsb\s*t+h?iago\s*lins$/i]
  const isNamedFullAccess = namedFullAccessPatterns.some((re) =>
    re.test(normalizedNameCompact)
  )
  const fullAccessEmails = new Set(["bsbthiagolins@gmail.com"])
  const isFullAccessEmail = fullAccessEmails.has(normalizedEmail)

  if (isUnlockAllPlanFeaturesEnv()) return "premium"
  if (isFullAccessEmail) return "premium"
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

export function shouldPromptPlanChoice(
  subscription: Subscription | null,
  exemptFromBillingRules = false
): boolean {
  if (exemptFromBillingRules) return false
  if (!subscription) return true
  if (needsTrialDecision(subscription, false)) return true
  if (subscription.status === "trial" && !isTrialActive(subscription)) return true
  if (subscription.post_trial_choice === "declined" && !isInPostDeclineGracePeriod(subscription)) {
    return true
  }
  if (subscription.status === "canceled" && !isInPostDeclineGracePeriod(subscription)) return true
  if (subscription.status === "past_due") return true
  return false
}

export function createTrialEndDate(days: number = TRIAL_DAYS): Date {
  const end = new Date()
  end.setDate(end.getDate() + Math.max(1, days))
  return end
}

export function isPostTrialChoice(
  value: string | null | undefined
): value is PostTrialChoice {
  return value === "accepted" || value === "declined"
}
