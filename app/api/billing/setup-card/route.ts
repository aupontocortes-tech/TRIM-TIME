import { NextResponse } from "next/server"
import { startTrialCardSetup } from "@/lib/asaas/billing-service"
import { getBarbershopIdFromRequest } from "@/lib/tenant"

export async function POST() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbershop não identificada" }, { status: 401 })
    }
    const result = await startTrialCardSetup(barbershopId)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error("[billing/setup-card]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao cadastrar cartão" },
      { status: 500 }
    )
  }
}
