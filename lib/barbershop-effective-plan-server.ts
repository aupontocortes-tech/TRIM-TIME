/**
 * Plano efetivo da barbearia no servidor: tenta Supabase (fetchBarbershopPlanContext);
 * se falhar (ex.: SUPABASE_SERVICE_ROLE_KEY ausente no Vercel), usa só Prisma.
 */
import { prisma } from "@/lib/prisma"
import { fetchBarbershopPlanContext } from "@/lib/barbershop-plan-server"
import { getEffectivePlanForBarbershop } from "@/lib/subscription"
import type {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/lib/db/types"

export async function resolveEffectivePlanForBarbershop(
  barbershopId: string
): Promise<SubscriptionPlan | null> {
  try {
    const ctx = await fetchBarbershopPlanContext(barbershopId)
    return ctx.plan
  } catch (e) {
    console.warn(
      "[resolveEffectivePlanForBarbershop] fallback Prisma (Supabase indisponível ou não configurado):",
      e instanceof Error ? e.message : e
    )
  }

  const [bs, sub] = await Promise.all([
    prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { role: true },
    }),
    prisma.subscription.findUnique({
      where: { barbershopId },
      select: { plan: true, status: true, trialEnd: true },
    }),
  ])

  const subscription: Subscription | null = sub
    ? {
        id: "",
        barbershop_id: barbershopId,
        plan: sub.plan as SubscriptionPlan,
        status: sub.status as SubscriptionStatus,
        trial_end: sub.trialEnd?.toISOString() ?? null,
        next_payment: null,
        created_at: "",
        updated_at: "",
      }
    : null

  return getEffectivePlanForBarbershop(bs, subscription)
}
