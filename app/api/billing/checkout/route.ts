import { NextResponse } from "next/server"
import { startSubscriptionCheckout } from "@/lib/asaas/billing-service"
import type { AsaasBillingType } from "@/lib/asaas/client"
import type { SubscriptionPlan } from "@/lib/db/types"
import { getBarbershopIdFromRequest } from "@/lib/tenant"

export async function POST(request: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbershop não identificada" }, { status: 401 })
    }

    const body = (await request.json()) as {
      plan?: SubscriptionPlan
      billing_type?: AsaasBillingType
    }
    const plan = body.plan
    if (!plan || !["basic", "pro", "premium"].includes(plan)) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 })
    }
    const billingType = body.billing_type
    if (!billingType || !["CREDIT_CARD", "PIX"].includes(billingType)) {
      return NextResponse.json(
        { error: "Informe billing_type: CREDIT_CARD ou PIX" },
        { status: 400 }
      )
    }

    const result = await startSubscriptionCheckout(barbershopId, plan, billingType)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error("[billing/checkout]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao iniciar pagamento" },
      { status: 500 }
    )
  }
}
