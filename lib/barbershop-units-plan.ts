import { prisma } from "@/lib/prisma"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import { hasFeature } from "@/lib/plans"
import type { SubscriptionPlan } from "@/lib/db/types"

/** Unidade matriz: nome igual à rede ou, se não houver, a mais antiga. */
export async function getPrincipalUnitId(barbershopId: string): Promise<string | null> {
  const barbershop = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { name: true },
  })
  const principalName = barbershop?.name?.trim()
  if (principalName) {
    const match = await prisma.barbershopUnit.findFirst({
      where: { barbershopId, name: principalName },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
    if (match) return match.id
  }
  const oldest = await prisma.barbershopUnit.findFirst({
    where: { barbershopId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  return oldest?.id ?? null
}

type PublicUnitRow = {
  id: string
  name: string
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  cep: string | null
  active?: boolean
}

/**
 * App do cliente: respeita arquivamento manual (`active`) e limita filiais extras
 * quando o plano não inclui multiunidade — sem alterar o banco.
 */
export function filterUnitsForPublicBooking<T extends PublicUnitRow>(
  units: T[],
  plan: SubscriptionPlan | null,
  principalUnitId: string | null
): T[] {
  const visible = units.filter((u) => u.active !== false)
  if (!plan || hasFeature(plan, "multi_units")) return visible
  if (!principalUnitId) return visible.slice(0, 1)
  const principal = visible.find((u) => u.id === principalUnitId)
  return principal ? [principal] : visible.slice(0, 1)
}

/**
 * Planos sem multiunidade não arquivam mais unidades no banco (evita sumiço no app do cliente).
 * Limites de plano são aplicados na leitura pública e na UI do painel.
 */
export async function applyMultiUnitPlanPolicy(
  _barbershopId: string,
  _plan: SubscriptionPlan
): Promise<{ archivedCount: number }> {
  return { archivedCount: 0 }
}

/** Reativa filiais desativadas pela política antiga (não pelo dono) em contas Premium. */
export async function repairPolicyArchivedUnits(barbershopId: string): Promise<number> {
  const effectivePlan = await resolveEffectivePlanForBarbershop(barbershopId)
  if (!effectivePlan || !hasFeature(effectivePlan, "multi_units")) {
    return 0
  }

  const principalId = await getPrincipalUnitId(barbershopId)
  const result = await prisma.barbershopUnit.updateMany({
    where: {
      barbershopId,
      active: false,
      archivedByUser: false,
      ...(principalId ? { id: { not: principalId } } : {}),
    },
    data: { active: true },
  })

  return result.count
}

export async function onBarbershopPlanChanged(
  barbershopId: string,
  _plan: SubscriptionPlan
): Promise<void> {
  await repairPolicyArchivedUnits(barbershopId)
}
