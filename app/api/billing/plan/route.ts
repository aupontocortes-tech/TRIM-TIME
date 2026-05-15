import { NextResponse } from "next/server"
import { changeSubscriptionPlan } from "@/lib/asaas/billing-service"
import type { SubscriptionPlan } from "@/lib/db/types"
import { getBarbershopIdFromRequest } from "@/lib/tenant"

export async function PATCH(request: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbershop não identificada" }, { status: 401 })
    }

    const body = (await request.json()) as { plan?: SubscriptionPlan }
    if (!body.plan || !["basic", "pro", "premium"].includes(body.plan)) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 })
    }

    const result = await changeSubscriptionPlan(barbershopId, body.plan)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error("[billing/plan]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao alterar plano" },
      { status: 500 }
    )
  }
}
