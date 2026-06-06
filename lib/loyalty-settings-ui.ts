import type { BarbershopLoyaltyProgram, BarbershopSettings } from "@/lib/db/types"

export type LoyaltyProgramUi = {
  enabled: boolean
  visitsRequired: string
  rewardLabel: string
  rewardKind: "service" | "product"
  rewardServiceId: string
  rewardProductId: string
}

export function defaultLoyaltyProgramUi(): LoyaltyProgramUi {
  return {
    enabled: false,
    visitsRequired: "10",
    rewardLabel: "Corte grátis",
    rewardKind: "service",
    rewardServiceId: "",
    rewardProductId: "",
  }
}

export function loyaltyProgramFromSettings(
  settings: BarbershopSettings | null | undefined
): LoyaltyProgramUi {
  const raw = settings?.loyalty_program
  if (!raw || typeof raw !== "object") return defaultLoyaltyProgramUi()
  return {
    enabled: !!raw.enabled,
    visitsRequired: String(raw.visits_required > 0 ? raw.visits_required : 10),
    rewardLabel: String(raw.reward_label ?? "").trim() || "Corte grátis",
    rewardKind: raw.reward_kind === "product" ? "product" : "service",
    rewardServiceId: raw.reward_service_id ?? "",
    rewardProductId: raw.reward_product_id ?? "",
  }
}

export function loyaltyProgramToSettings(ui: LoyaltyProgramUi): BarbershopLoyaltyProgram {
  const visits = Math.max(1, Math.min(100, Math.round(Number(ui.visitsRequired) || 10)))
  const kind = ui.rewardKind === "product" ? "product" : "service"
  return {
    enabled: ui.enabled,
    visits_required: visits,
    reward_label: ui.rewardLabel.trim() || "Recompensa",
    reward_kind: kind,
    reward_service_id: kind === "service" && ui.rewardServiceId.trim() ? ui.rewardServiceId.trim() : null,
    reward_product_id: kind === "product" && ui.rewardProductId.trim() ? ui.rewardProductId.trim() : null,
  }
}
