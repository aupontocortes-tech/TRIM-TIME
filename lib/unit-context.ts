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

