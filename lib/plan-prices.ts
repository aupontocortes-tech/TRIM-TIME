import type { SubscriptionPlan } from "@/lib/db/types"
import { PLAN_PRICES } from "@/lib/plans"

export type PlanPricesMap = Record<SubscriptionPlan, number>

export function defaultPlanPrices(): PlanPricesMap {
  return { ...PLAN_PRICES }
}

export function mergePlanPricesFromDb(input: {
  priceBasic?: unknown
  pricePro?: unknown
  pricePremium?: unknown
}): PlanPricesMap {
  const base = defaultPlanPrices()
  const b = input.priceBasic != null ? Number(input.priceBasic) : NaN
  const p = input.pricePro != null ? Number(input.pricePro) : NaN
  const pr = input.pricePremium != null ? Number(input.pricePremium) : NaN
  if (Number.isFinite(b) && b > 0) base.basic = Math.round(b * 100) / 100
  if (Number.isFinite(p) && p > 0) base.pro = Math.round(p * 100) / 100
  if (Number.isFinite(pr) && pr > 0) base.premium = Math.round(pr * 100) / 100
  return base
}

export function parsePlanPriceInput(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."))
  if (!Number.isFinite(n) || n <= 0 || n > 99999) return null
  return Math.round(n * 100) / 100
}

export function isPaymentApiEnabledFromEnv(): boolean {
  const v = process.env.PAYMENT_API_ENABLED?.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}
