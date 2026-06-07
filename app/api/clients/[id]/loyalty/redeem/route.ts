import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import type { BarbershopSettings } from "@/lib/db/types"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { redeemLoyaltyReward } from "@/lib/loyalty-program-server"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id: clientId } = await params

    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { settings: true },
    })
    if (!barbershop) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    const settings = (barbershop.settings as BarbershopSettings | null) ?? null
    const result = await redeemLoyaltyReward({
      barbershopId,
      clientId,
      settings,
      plan,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 })
    }

    return NextResponse.json({ ok: true, loyalty: result.status })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao resgatar recompensa" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
