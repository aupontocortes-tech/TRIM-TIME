/**
 * Operações de fidelidade que acessam o banco (API routes / Server Components).
 */
import type {
  BarbershopLoyaltyProgram,
  BarbershopSettings,
  LoyaltyClientStatus,
  SubscriptionPlan,
} from "@/lib/db/types"
import { prisma } from "@/lib/prisma"
import {
  LOYALTY_REASON_COMPLETED,
  LOYALTY_REASON_REDEEMED,
  computeClientLoyaltyStatus,
  loyaltyProgramEnabled,
  parseLoyaltyProgram,
} from "@/lib/loyalty-program"

export async function assertLoyaltyRewardRefs(
  barbershopId: string,
  config: BarbershopLoyaltyProgram
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!config.enabled) return { ok: true }
  if (config.reward_kind === "service" && config.reward_service_id) {
    const row = await prisma.service.findFirst({
      where: { id: config.reward_service_id, barbershopId, active: true },
      select: { id: true },
    })
    if (!row) return { ok: false, error: "Serviço da recompensa inválido ou inativo." }
  }
  if (config.reward_kind === "product" && config.reward_product_id) {
    const row = await prisma.retailProduct.findFirst({
      where: { id: config.reward_product_id, barbershopId, active: true },
      select: { id: true },
    })
    if (!row) return { ok: false, error: "Produto da recompensa inválido ou inativo." }
  }
  return { ok: true }
}

export async function creditLoyaltyVisitForAppointment(params: {
  barbershopId: string
  clientId: string
  appointmentId: string
  settings: BarbershopSettings | null | undefined
  plan: SubscriptionPlan | null
}): Promise<{ credited: boolean; status?: LoyaltyClientStatus }> {
  const config = parseLoyaltyProgram(params.settings)
  if (!config || !loyaltyProgramEnabled(params.plan)) return { credited: false }

  const existing = await prisma.loyaltyLedgerEntry.findFirst({
    where: {
      appointmentId: params.appointmentId,
      reason: LOYALTY_REASON_COMPLETED,
    },
    select: { id: true },
  })
  if (existing) return { credited: false }

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, barbershopId: params.barbershopId },
    select: { id: true, loyaltyPoints: true },
  })
  if (!client) return { credited: false }

  const nextPoints = client.loyaltyPoints + 1

  await prisma.$transaction([
    prisma.client.update({
      where: { id: client.id },
      data: { loyaltyPoints: nextPoints },
    }),
    prisma.loyaltyLedgerEntry.create({
      data: {
        barbershopId: params.barbershopId,
        clientId: client.id,
        deltaPoints: 1,
        reason: LOYALTY_REASON_COMPLETED,
        appointmentId: params.appointmentId,
      },
    }),
  ])

  return {
    credited: true,
    status: computeClientLoyaltyStatus(nextPoints, config),
  }
}

export async function redeemLoyaltyReward(params: {
  barbershopId: string
  clientId: string
  settings: BarbershopSettings | null | undefined
  plan: SubscriptionPlan | null
}): Promise<
  | { ok: true; status: LoyaltyClientStatus }
  | { ok: false; error: string; status?: number }
> {
  const config = parseLoyaltyProgram(params.settings)
  if (!config || !loyaltyProgramEnabled(params.plan)) {
    return { ok: false, error: "Programa de fidelidade não está ativo.", status: 400 }
  }

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, barbershopId: params.barbershopId },
    select: { id: true, loyaltyPoints: true },
  })
  if (!client) return { ok: false, error: "Cliente não encontrado.", status: 404 }
  if (client.loyaltyPoints < config.visits_required) {
    return { ok: false, error: "Este cliente ainda não tem recompensa disponível.", status: 400 }
  }

  const nextPoints = client.loyaltyPoints - config.visits_required

  await prisma.$transaction([
    prisma.client.update({
      where: { id: client.id },
      data: { loyaltyPoints: nextPoints },
    }),
    prisma.loyaltyLedgerEntry.create({
      data: {
        barbershopId: params.barbershopId,
        clientId: client.id,
        deltaPoints: -config.visits_required,
        reason: LOYALTY_REASON_REDEEMED,
      },
    }),
  ])

  return {
    ok: true,
    status: computeClientLoyaltyStatus(nextPoints, config),
  }
}
