import { NextResponse } from "next/server"
import { startPaidSubscriptionEarly } from "@/lib/asaas/billing-service"
import type { SubscriptionPlan } from "@/lib/db/types"
import { getBarbershopIdFromRequest } from "@/lib/tenant"

/** Durante trial: primeira cobrança na data atual (opcional pelo cliente). */
export async function POST(request: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbershop não identificada" }, { status: 401 })
    }

    const body = (await request.json()) as { plan?: SubscriptionPlan }
    if (!body.plan || !["basic", "pro", "premium"].includes(body.plan)) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 })
    }

    const result = await startPaidSubscriptionEarly(barbershopId, body.plan)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error("[billing/subscribe-early]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao iniciar cobrança" },
      { status: 500 }
    )
  }
}
