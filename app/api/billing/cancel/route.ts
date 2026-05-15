import { NextResponse } from "next/server"
import { cancelBarbershopSubscription } from "@/lib/asaas/billing-service"
import { getBarbershopIdFromRequest } from "@/lib/tenant"

export async function POST() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbershop não identificada" }, { status: 401 })
    }

    await cancelBarbershopSubscription(barbershopId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[billing/cancel]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao cancelar" },
      { status: 500 }
    )
  }
}
