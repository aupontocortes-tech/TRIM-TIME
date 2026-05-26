import { NextResponse } from "next/server"
import { cancelTrialBeforeAutoCharge } from "@/lib/asaas/billing-service"
import { getBarbershopIdFromRequest } from "@/lib/tenant"

/** Cancela o teste grátis antes da cobrança automática. */
export async function POST() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbershop não identificada" }, { status: 401 })
    }
    await cancelTrialBeforeAutoCharge(barbershopId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[billing/cancel-trial]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao cancelar teste" },
      { status: 500 }
    )
  }
}
