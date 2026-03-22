/**
 * Plano efetivo da barbearia (server-only) — usado em APIs para gates de recurso.
 */
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getEffectivePlanForBarbershop } from "@/lib/subscription"
import type { Subscription, SubscriptionPlan } from "@/lib/db/types"

export type BarbershopPlanContext = {
  plan: SubscriptionPlan | null
  /** Valor da coluna `barbershops.role` (ex.: super_admin, admin_barbershop). */
  barbershopRole: string | null
}

async function loadPlanContext(barbershopId: string): Promise<BarbershopPlanContext> {
  const supabase = createServiceRoleClient()
  const [{ data: bs }, { data: sub }] = await Promise.all([
    supabase.from("barbershops").select("role").eq("id", barbershopId).single(),
    supabase.from("subscriptions").select("plan, status, trial_end").eq("barbershop_id", barbershopId).single(),
  ])
  const subscription = sub
    ? ({
        plan: sub.plan as SubscriptionPlan,
        status: sub.status,
        trial_end: sub.trial_end ?? null,
      } as Subscription)
    : null
  const plan = getEffectivePlanForBarbershop(bs as { role?: string } | null, subscription)
  const role = (bs as { role?: string } | null)?.role ?? null
  return { plan, barbershopRole: role }
}

/** Plano + role da barbearia (uma leitura ao banco). */
export async function fetchBarbershopPlanContext(barbershopId: string): Promise<BarbershopPlanContext> {
  return loadPlanContext(barbershopId)
}

export async function fetchEffectivePlanForBarbershop(
  barbershopId: string
): Promise<SubscriptionPlan | null> {
  const { plan } = await loadPlanContext(barbershopId)
  return plan
}
