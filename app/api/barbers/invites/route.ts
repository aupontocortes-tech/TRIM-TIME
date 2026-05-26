import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { canAddBarber, getBarberLimitMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"

const DEFAULT_DAYS = 7
const MAX_DAYS = 30

export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const body = (await request.json().catch(() => ({}))) as { days_valid?: number }
    let days = Number(body.days_valid ?? DEFAULT_DAYS)
    if (!Number.isFinite(days) || days < 1) days = DEFAULT_DAYS
    days = Math.min(Math.floor(days), MAX_DAYS)

    const [plan, currentCount] = await Promise.all([
      resolveEffectivePlanForActiveSession(barbershopId),
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

    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + days)

    await prisma.barberInvite.create({
      data: {
        barbershopId,
        token,
        expiresAt,
      },
    })

    return NextResponse.json({
      token,
      expires_at: expiresAt.toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao gerar convite" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
