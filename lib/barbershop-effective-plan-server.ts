/**
 * Plano efetivo da barbearia no servidor: tenta Supabase (fetchBarbershopPlanContext);
 * se falhar (ex.: SUPABASE_SERVICE_ROLE_KEY ausente no Vercel), usa só Prisma.
 */
import { prisma } from "@/lib/prisma"
import { fetchBarbershopPlanContext } from "@/lib/barbershop-plan-server"
import { getEffectivePlanForBarbershop } from "@/lib/subscription"
import { getRealBarbershopIdFromRequest } from "@/lib/tenant"
import type {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/lib/db/types"

/**
 * Plano efetivo para o painel/API autenticadas: se quem está logado for `super_admin`
 * (cookie real), trata como Premium mesmo quando impersona outra barbearia (sem assinatura).
 */
export async function resolveEffectivePlanForActiveSession(
  tenantBarbershopId: string
): Promise<SubscriptionPlan | null> {
  try {
    const realId = await getRealBarbershopIdFromRequest()
    if (realId) {
      const real = await prisma.barbershop.findUnique({
        where: { id: realId },
        select: { role: true, suspendedAt: true },
      })
      if (real && !real.suspendedAt && real.role === "super_admin") {
        return "premium"
      }
    }
  } catch {
    /* segue com plano da barbearia do tenant */
  }
  return resolveEffectivePlanForBarbershop(tenantBarbershopId)
}

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
      select: { name: true, role: true, isTest: true },
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

  return getEffectivePlanForBarbershop(
    bs ? { name: bs.name, role: bs.role, is_test: bs.isTest } : null,
    subscription
  )
}
