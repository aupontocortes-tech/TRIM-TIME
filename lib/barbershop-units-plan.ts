import { prisma } from "@/lib/prisma"
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

/**
 * Planos sem multiunidade: filiais extras ficam arquivadas (active=false), sem apagar nome,
 * barbeiros, clientes nem histórico. Ao voltar ao Premium, o dono reativa em Configurações.
 */
export async function applyMultiUnitPlanPolicy(
  barbershopId: string,
  plan: SubscriptionPlan
): Promise<{ archivedCount: number }> {
  if (hasFeature(plan, "multi_units")) {
    return { archivedCount: 0 }
  }

  const principalId = await getPrincipalUnitId(barbershopId)
  if (!principalId) return { archivedCount: 0 }

  const result = await prisma.barbershopUnit.updateMany({
    where: {
      barbershopId,
      id: { not: principalId },
      active: true,
    },
    data: { active: false },
  })

  return { archivedCount: result.count }
}

export async function onBarbershopPlanChanged(
  barbershopId: string,
  plan: SubscriptionPlan
): Promise<void> {
  await applyMultiUnitPlanPolicy(barbershopId, plan)
}
