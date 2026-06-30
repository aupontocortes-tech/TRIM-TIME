import type { SubscriptionPlan } from "@/lib/db/types"
import type { PlanPricesMap } from "@/lib/plan-prices"

/** Valor mensal do plano no padrão brasileiro (ex.: 1,00 · 59,90). */
export function formatPlanPriceAmount(value: number): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return "0,00"
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Ex.: R$ 1,00 */
export function formatPlanPrice(value: number): string {
  return `R$ ${formatPlanPriceAmount(value)}`
}

/** Ex.: R$ 59,90/mês */
export function formatPlanPricePerMonth(value: number): string {
  return `${formatPlanPrice(value)}/mês`
}

export function formatPlanPricesMap(prices: PlanPricesMap): Record<SubscriptionPlan, string> {
  return {
    basic: formatPlanPrice(prices.basic),
    pro: formatPlanPrice(prices.pro),
    premium: formatPlanPrice(prices.premium),
  }
}

/** Texto para campo do Super ADM (ex.: 59,90). */
export function formatPlanPriceFieldValue(value: number): string {
  return formatPlanPriceAmount(value)
}
