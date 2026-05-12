/**
 * Simulação de plano no painel (dev / flag explícita): cookie `trimtime_simulate_plan`.
 * Usada para testar Básico/Pro/Premium mesmo com conta super_admin ou unlock .env.
 */
import { cookies } from "next/headers"
import type { SubscriptionPlan } from "@/lib/db/types"
import { PLAN_SIMULATION_COOKIE_NAME } from "@/lib/plan-simulation-constants"

export { PLAN_SIMULATION_COOKIE_NAME as PLAN_SIMULATION_COOKIE }

type PlanCtx = { plan: SubscriptionPlan | null; barbershopRole: string | null }

export function isPlanSimulationAllowed(): boolean {
  const v = process.env.TRIMTIME_ALLOW_PLAN_SIMULATION?.trim().toLowerCase()
  if (v === "1" || v === "true" || v === "yes") return true
  return process.env.NODE_ENV === "development"
}

function parseSimulatedPlan(raw: string | undefined): SubscriptionPlan | null {
  if (!raw) return null
  const p = raw.trim().toLowerCase()
  if (p === "basic" || p === "pro" || p === "premium") return p
  return null
}

/** Plano simulado para esta requisição, ou null. */
export async function getPlanSimulationOverride(): Promise<SubscriptionPlan | null> {
  if (!isPlanSimulationAllowed()) return null
  const store = await cookies()
  return parseSimulatedPlan(store.get(PLAN_SIMULATION_COOKIE_NAME)?.value)
}

export async function mergePlanContextWithSimulation(
  ctx: PlanCtx
): Promise<{ plan: SubscriptionPlan | null; barbershopRole: string | null }> {
  const sim = await getPlanSimulationOverride()
  if (!sim) {
    return { plan: ctx.plan, barbershopRole: ctx.barbershopRole }
  }
  return { plan: sim, barbershopRole: ctx.barbershopRole }
}
