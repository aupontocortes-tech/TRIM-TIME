import type { Prisma } from "@prisma/client"
import { getBarbershopUnitIdFromRequest } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

export type BarberUnitValidation =
  | { ok: true }
  | { ok: false; status: number; error: string }

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

/** Barbearia com mais de uma unidade cadastrada (inclui inativas — alinha com o seletor do painel). */
export async function barbershopHasMultipleUnits(barbershopId: string): Promise<boolean> {
  const n = await prisma.barbershopUnit.count({ where: { barbershopId } })
  return n > 1
}

/** Unidade para listagens do painel: query `unit_id` tem prioridade sobre o cookie. */
export async function resolveBarberListUnitId(
  barbershopId: string,
  queryUnitId?: string | null
): Promise<string | null> {
  const fromQuery = queryUnitId?.trim() || null
  if (fromQuery) {
    const row = await prisma.barbershopUnit.findFirst({
      where: { id: fromQuery, barbershopId },
      select: { id: true },
    })
    return row?.id ?? null
  }
  return resolveSelectedUnitId(barbershopId)
}

export const resolveClientListUnitId = resolveBarberListUnitId

/**
 * Filtro de agendamentos por unidade ativa no painel.
 * Com unidade escolhida: só essa unidade — cada unidade é um contexto separado (unidade nova = zerada).
 * Sem unidade (Todas): não restringe por `unit_id` (visão da rede + legados sem unidade).
 */
export function prismaAppointmentUnitFilter(selectedUnitId: string | null): Prisma.AppointmentWhereInput {
  if (!selectedUnitId) return {}
  return {
    OR: [
      { unitId: selectedUnitId },
      { unitId: null, barber: { unitId: selectedUnitId } },
    ],
  }
}

/**
 * Filtro de equipe: com unidade escolhida, só profissionais com `unit_id` exato.
 * Sem unidade (Todas): todos da barbearia.
 */
export function prismaBarberUnitFilter(selectedUnitId: string | null): Prisma.BarberWhereInput {
  if (!selectedUnitId) return {}
  return { unitId: selectedUnitId }
}

/**
 * Filtro de clientes: com unidade escolhida, só desta loja (cadastro ou histórico legado).
 * Sem unidade (Todas): todos da barbearia.
 */
export function prismaClientUnitFilter(
  selectedUnitId: string | null,
  multiUnit: boolean
): Prisma.ClientWhereInput {
  if (!selectedUnitId) return {}
  if (multiUnit) {
    return {
      OR: [
        { unitId: selectedUnitId },
        {
          unitId: null,
          OR: [
            { appointments: { some: { unitId: selectedUnitId } } },
            { waitingList: { some: { barber: { unitId: selectedUnitId } } } },
          ],
        },
      ],
    }
  }
  return {
    OR: [{ unitId: selectedUnitId }, { unitId: null }],
  }
}

/** Filtro da fila de espera pelo profissional da unidade ativa. */
export function prismaWaitlistUnitFilter(selectedUnitId: string | null): Prisma.WaitingListItemWhereInput {
  if (!selectedUnitId) return {}
  return { barber: { unitId: selectedUnitId } }
}

/** Unidade ativa no painel para criar cliente manualmente. */
export async function requireSelectedUnitForClientCreate(
  barbershopId: string
): Promise<{ unitId: string | null; error?: string }> {
  return requireSelectedUnitForBarberCreate(barbershopId)
}

/**
 * Garante que o barbeiro pode atender na unidade do agendamento.
 */
export async function validateBarberForUnit(params: {
  barbershopId: string
  barberId: string
  unitId: string | null
}): Promise<BarberUnitValidation> {
  const barber = await prisma.barber.findFirst({
    where: { id: params.barberId, barbershopId: params.barbershopId, active: true },
    select: { id: true, unitId: true },
  })
  if (!barber) {
    return { ok: false, status: 400, error: "Profissional inválido" }
  }

  const activeUnits = await prisma.barbershopUnit.findMany({
    where: { barbershopId: params.barbershopId, active: true },
    select: { id: true },
  })

  if (activeUnits.length <= 1) {
    return { ok: true }
  }

  if (!params.unitId) {
    return { ok: false, status: 400, error: "Selecione a unidade para este agendamento." }
  }

  if (!barber.unitId) {
    return {
      ok: false,
      status: 400,
      error: "Este profissional ainda não está vinculado a uma unidade. Ajuste na aba Equipe.",
    }
  }

  if (barber.unitId !== params.unitId) {
    return {
      ok: false,
      status: 400,
      error: "Este profissional não atende nesta unidade.",
    }
  }

  return { ok: true }
}

/** Unidade ativa no painel para criar barbeiro ou convite. */
export async function requireSelectedUnitForBarberCreate(
  barbershopId: string
): Promise<{ unitId: string | null; error?: string }> {
  const activeUnits = await prisma.barbershopUnit.findMany({
    where: { barbershopId, active: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })

  if (activeUnits.length === 0) {
    return { unitId: null }
  }

  if (activeUnits.length === 1) {
    return { unitId: activeUnits[0].id }
  }

  const selected = await resolveSelectedUnitId(barbershopId)
  if (!selected) {
    return {
      unitId: null,
      error: "Selecione uma unidade na barra lateral antes de adicionar.",
    }
  }

  return { unitId: selected }
}

