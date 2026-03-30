import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { canAddBarber, canUseBarberCommission, getBarberLimitMessage, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import { prisma } from "@/lib/prisma"
import type { Barber } from "@/lib/db/types"

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    const data = await prisma.barber.findMany({
      where: { barbershopId },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(
      data.map((b) => ({
        id: b.id,
        barbershop_id: b.barbershopId,
        name: b.name,
        phone: b.phone,
        commission: Number(b.commission),
        active: b.active,
        role: b.role,
        created_at: b.createdAt.toISOString(),
        updated_at: b.updatedAt.toISOString(),
      })) as Barber[]
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não autorizado" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const [barbershop, plan, currentCount] = await Promise.all([
      prisma.barbershop.findUnique({
        where: { id: barbershopId },
        select: { role: true, isTest: true },
      }),
      resolveEffectivePlanForBarbershop(barbershopId),
      prisma.barber.count({ where: { barbershopId } }),
    ])
    if (!plan) {
      return NextResponse.json(
        { error: "Assinatura não ativa. Escolha um plano." },
        { status: 403 }
      )
    }
    if (!canAddBarber(plan, currentCount)) {
      return NextResponse.json(
        { error: getBarberLimitMessage(plan), code: "PLAN_LIMIT" },
        { status: 403 }
      )
    }

    const body = await request.json() as { name: string; phone?: string; commission?: number }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }

    const commissionAllowed = canUseBarberCommission(
      plan,
      barbershop?.role ?? null,
      barbershop?.isTest ?? false
    )
    let commission = body.commission ?? 0
    if (!commissionAllowed) {
      if (body.commission != null && Number(body.commission) !== 0) {
        return NextResponse.json(
          { error: getUpgradeMessage("barber_commission"), code: "PLAN_FEATURE" },
          { status: 403 }
        )
      }
      commission = 0
    } else {
      const c = Number(commission)
      if (!Number.isFinite(c) || c < 0 || c > 100) {
        return NextResponse.json({ error: "Comissão deve ser entre 0 e 100%." }, { status: 400 })
      }
      commission = c
    }

    const data = await prisma.barber.create({
      data: {
        barbershopId,
        name: body.name.trim(),
        phone: body.phone?.trim() ?? null,
        commission,
        active: true,
      },
    })
    return NextResponse.json({
      id: data.id,
      barbershop_id: data.barbershopId,
      name: data.name,
      phone: data.phone,
      commission: Number(data.commission),
      active: data.active,
      role: data.role,
      created_at: data.createdAt.toISOString(),
      updated_at: data.updatedAt.toISOString(),
    } as Barber)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar barbeiro" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
