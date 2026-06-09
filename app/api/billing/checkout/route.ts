import { NextResponse } from "next/server"
import { startSubscriptionCheckout } from "@/lib/asaas/billing-service"
import type { SubscriptionPlan } from "@/lib/db/types"
import { getBarbershopIdFromRequest } from "@/lib/tenant"

export async function POST(request: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbershop não identificada" }, { status: 401 })
    }

    const body = (await request.json()) as { plan?: SubscriptionPlan }
    const plan = body.plan
    if (!plan || !["basic", "pro", "premium"].includes(plan)) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 })
    }

    const result = await startSubscriptionCheckout(barbershopId, plan, "CREDIT_CARD")
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error("[billing/checkout]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao iniciar pagamento" },
      { status: 500 }
    )
  }
}
