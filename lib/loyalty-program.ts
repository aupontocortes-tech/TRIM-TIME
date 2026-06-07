/**
 * Programa de fidelidade — config em `barbershops.settings.loyalty_program`,
 * saldo em `clients.loyalty_points`, histórico em `loyalty_ledger_entries`.
 */
import type { Prisma } from "@prisma/client"
import type {
  BarbershopLoyaltyProgram,
  BarbershopSettings,
  LoyaltyClientStatus,
  SubscriptionPlan,
} from "@/lib/db/types"
import { hasFeature } from "@/lib/plans"

export const LOYALTY_REASON_COMPLETED = "appointment_completed"
export const LOYALTY_REASON_REDEEMED = "reward_redeemed"

export function loyaltyProgramEnabled(plan: SubscriptionPlan | null): boolean {
  return !!(plan && hasFeature(plan, "loyalty_program"))
}

export function parseLoyaltyProgram(
  settings: BarbershopSettings | null | undefined
): BarbershopLoyaltyProgram | null {
  const raw = settings?.loyalty_program
  if (!raw || typeof raw !== "object" || !raw.enabled) return null
  const visits = Math.round(Number(raw.visits_required))
  if (!Number.isFinite(visits) || visits < 1) return null
  const label = String(raw.reward_label ?? "").trim()
  if (!label) return null
  const kind = raw.reward_kind === "product" ? "product" : "service"
  if (kind === "service" && !raw.reward_service_id) return null
  if (kind === "product" && !raw.reward_product_id) return null
  return {
    enabled: true,
    visits_required: Math.min(100, visits),
    reward_label: label,
    reward_kind: kind,
    reward_service_id: kind === "service" ? raw.reward_service_id ?? null : null,
    reward_product_id: kind === "product" ? raw.reward_product_id ?? null : null,
  }
}

export function isLoyaltyProgramActive(
  settings: BarbershopSettings | null | undefined,
  plan: SubscriptionPlan | null
): boolean {
  return loyaltyProgramEnabled(plan) && parseLoyaltyProgram(settings) != null
}

export function computeClientLoyaltyStatus(
  loyaltyPoints: number,
  config: BarbershopLoyaltyProgram | null
): LoyaltyClientStatus {
  if (!config) {
    return {
      enabled: false,
      current_visits: 0,
      visits_required: 0,
      visits_remaining: 0,
      progress_percent: 0,
      reward_available: false,
      reward_label: "",
    }
  }
  const required = config.visits_required
  const points = Math.max(0, Math.round(loyaltyPoints))
  const rewardAvailable = points >= required
  const currentVisits = rewardAvailable ? required : points
  const visitsRemaining = rewardAvailable ? 0 : Math.max(0, required - points)
  const progressPercent = rewardAvailable
    ? 100
    : Math.min(100, Math.round((points / required) * 100))

  return {
    enabled: true,
    current_visits: currentVisits,
    visits_required: required,
    visits_remaining: visitsRemaining,
    progress_percent: progressPercent,
    reward_available: rewardAvailable,
    reward_label: config.reward_label,
    reward_kind: config.reward_kind,
  }
}

export function validateLoyaltyProgramInput(
  input: BarbershopLoyaltyProgram,
  plan: SubscriptionPlan | null
): { ok: true; config: BarbershopLoyaltyProgram } | { ok: false; error: string } {
  if (!loyaltyProgramEnabled(plan)) {
    return { ok: false, error: "Programa de fidelidade disponível no plano Premium." }
  }
  if (!input.enabled) {
    return {
      ok: true,
      config: {
        enabled: false,
        visits_required: 10,
        reward_label: "",
        reward_kind: "service",
        reward_service_id: null,
        reward_product_id: null,
      },
    }
  }
  const visits = Math.round(Number(input.visits_required))
  if (!Number.isFinite(visits) || visits < 1 || visits > 100) {
    return { ok: false, error: "Informe entre 1 e 100 visitas para a recompensa." }
  }
  const label = String(input.reward_label ?? "").trim()
  if (!label) return { ok: false, error: "Informe o nome da recompensa." }
  if (label.length > 120) return { ok: false, error: "Nome da recompensa muito longo (máx. 120)." }
  const kind = input.reward_kind === "product" ? "product" : "service"
  if (kind === "service" && !input.reward_service_id?.trim()) {
    return { ok: false, error: "Selecione o serviço da recompensa." }
  }
  if (kind === "product" && !input.reward_product_id?.trim()) {
    return { ok: false, error: "Selecione o produto da recompensa." }
  }
  return {
    ok: true,
    config: {
      enabled: true,
      visits_required: visits,
      reward_label: label,
      reward_kind: kind,
      reward_service_id: kind === "service" ? input.reward_service_id!.trim() : null,
      reward_product_id: kind === "product" ? input.reward_product_id!.trim() : null,
    },
  }
}

export function mergeLoyaltyProgramSettings(
  prev: Prisma.JsonValue | null | undefined,
  inc: BarbershopLoyaltyProgram | null | undefined
): Prisma.InputJsonValue | undefined {
  if (inc === undefined) return undefined
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {}
  if (!inc || !inc.enabled) {
    delete base.loyalty_program
    return base as Prisma.InputJsonValue
  }
  base.loyalty_program = inc
  return base as Prisma.InputJsonValue
}
