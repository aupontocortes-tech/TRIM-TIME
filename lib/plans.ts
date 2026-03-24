/**
 * Planos de assinatura e limites - Trim Time SaaS
 */

import type { SubscriptionPlan } from "@/lib/db/types"

export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  basic: 19,
  pro: 39,
  premium: 79,
}

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  basic: "Básico",
  pro: "Pro",
  premium: "Premium",
}

/** Limite de barbeiros por plano. Premium = null = ilimitado */
export const BARBER_LIMITS: Record<SubscriptionPlan, number | null> = {
  basic: 1,
  pro: 5,
  premium: null, // ilimitado
}

/** Dias de trial para novas barbearias (plano Premium) */
export const TRIAL_DAYS = 7

/** Recursos por plano */
export const PLAN_FEATURES = {
  basic: [
    "Agenda de horários",
    "Bloqueio de horários",
    "Cadastro de clientes",
    "Histórico de cortes",
    "Anotações de clientes",
    "Armazenamento em nuvem",
    "Notificações push no app",
    "1 barbeiro",
  ],
  pro: [
    "Tudo do Básico",
    "Até 5 barbeiros",
    "Lista de espera automática",
    "Controle financeiro",
    "Relatórios mensais simples",
    "Comissão de barbeiros",
    "Cadastro de serviços e preços",
    "Notificações por email",
    "Backup de dados",
  ],
  premium: [
    "Tudo do Pro",
    "Barbeiros ilimitados",
    "Unidades ilimitadas",
    "Agendamento online",
    "Link público de agendamento",
    "Dashboard completo",
    "Relatórios avançados",
    "Programa de fidelidade",
    "Marketing para clientes inativos",
    "Integração WhatsApp Business API",
    "Lembretes e confirmações automáticas",
    "Remover 'Powered by Trim Time'",
  ],
} as const

/** Verifica se o plano tem o recurso (por chave) */
const FEATURE_KEYS: Record<string, SubscriptionPlan[]> = {
  waiting_list: ["pro", "premium"],
  financial: ["pro", "premium"],
  barber_commission: ["pro", "premium"],
  services_prices: ["pro", "premium"],
  email_notifications: ["pro", "premium"],
  backup: ["pro", "premium"],
  online_booking: ["premium"],
  multi_units: ["premium"],
  public_booking_link: ["premium"],
  advanced_reports: ["premium"],
  loyalty_program: ["premium"],
  marketing_inactive: ["premium"],
  whatsapp_integration: ["premium"],
  whatsapp_reminders: ["premium"],
  remove_branding: ["premium"],
}

export function getBarberLimit(plan: SubscriptionPlan): number | null {
  return BARBER_LIMITS[plan]
}

export function canAddBarber(plan: SubscriptionPlan, currentCount: number): boolean {
  const limit = getBarberLimit(plan)
  if (limit === null) return true
  return currentCount < limit
}

export function hasFeature(plan: SubscriptionPlan, featureKey: keyof typeof FEATURE_KEYS): boolean {
  const plans = FEATURE_KEYS[featureKey]
  if (!plans) return false
  return plans.includes(plan)
}

/** Comissão por barbeiro: Pro/Premium, ou super_admin (acesso total ao SaaS). */
export function canUseBarberCommission(
  plan: SubscriptionPlan | null,
  barbershopRole?: string | null,
  isTest?: boolean | null
): boolean {
  if (barbershopRole === "super_admin") return true
  if (isTest === true) return true
  return !!(plan && hasFeature(plan, "barber_commission"))
}

export function getUpgradeMessage(featureKey: keyof typeof FEATURE_KEYS): string {
  return "Este recurso não está disponível no seu plano. Faça upgrade para desbloquear."
}

export function getBarberLimitMessage(plan: SubscriptionPlan): string {
  const limit = getBarberLimit(plan)
  if (limit === null) return ""
  if (limit === 1) return "Seu plano permite apenas 1 barbeiro. Faça upgrade para o Pro ou Premium para adicionar mais."
  return `Seu plano permite até ${limit} barbeiros. Faça upgrade para o Premium para barbeiros ilimitados.`
}
