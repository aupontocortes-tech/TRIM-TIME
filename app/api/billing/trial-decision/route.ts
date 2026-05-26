import { NextResponse } from "next/server"
import {
  acceptTrialAndSubscribe,
  declineTrialSubscription,
} from "@/lib/asaas/billing-service"
import type { SubscriptionPlan } from "@/lib/db/types"
import { getBarbershopIdFromRequest } from "@/lib/tenant"

export async function POST(request: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbershop não identificada" }, { status: 401 })
    }

    const body = (await request.json()) as {
      action?: "accept" | "decline"
      plan?: SubscriptionPlan
    }

    if (body.action === "decline") {
      await declineTrialSubscription(barbershopId)
      return NextResponse.json({ ok: true, declined: true })
    }

    if (body.action !== "accept") {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
    }

    const plan = body.plan
    if (!plan || !["basic", "pro", "premium"].includes(plan)) {
      return NextResponse.json({ error: "Escolha um plano válido" }, { status: 400 })
    }

    const result = await acceptTrialAndSubscribe(barbershopId, plan)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error("[billing/trial-decision]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao processar decisão" },
      { status: 500 }
    )
  }
}
