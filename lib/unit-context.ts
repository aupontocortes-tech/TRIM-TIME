import type { Prisma } from "@prisma/client"
import { getBarbershopUnitIdFromRequest } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

/**
 * Resolve unidade selecionada no request. Se cookie estiver inválido para a barbearia,
 * retorna null (modo "todas as unidades").
 */
export async function resolveSelectedUnitId(barbershopId: string): Promise<string | null> {
  const unitId = await getBarbershopUnitIdFromRequest()
  if (!unitId) return null

  const row = await prisma.barbershopUnit.findFirst({
    where: { id: unitId, barbershopId },
    select: { id: true },
  })

  return row?.id ?? null
}

/**
 * Filtro de agendamentos por unidade ativa no painel.
 * Com unidade escolhida: só essa unidade — cada unidade é um contexto separado (unidade nova = zerada).
 * Sem unidade (Todas): não restringe por `unit_id` (visão da rede + legados sem unidade).
 */
export function prismaAppointmentUnitFilter(selectedUnitId: string | null): Prisma.AppointmentWhereInput {
  if (!selectedUnitId) return {}
  return { unitId: selectedUnitId }
}

