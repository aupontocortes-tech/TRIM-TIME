import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireBarbershopId } from "@/lib/tenant"
import { canAddBarber, getBarberLimitMessage, getUpgradeMessage, hasFeature } from "@/lib/plans"
import { getEffectivePlanForBarbershop } from "@/lib/subscription"
import { fetchEffectivePlanForBarbershop } from "@/lib/barbershop-plan-server"
import type { Barber } from "@/lib/db/types"

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("barbers")
      .select("*")
      .eq("barbershop_id", barbershopId)
      .order("name")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as Barber[])
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não autorizado" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const supabase = createServiceRoleClient()

    const [{ data: barbershop }, { data: sub }] = await Promise.all([
      supabase.from("barbershops").select("role").eq("id", barbershopId).single(),
      supabase.from("subscriptions").select("plan, status, trial_end").eq("barbershop_id", barbershopId).single(),
    ])
    const plan = getEffectivePlanForBarbershop(
      barbershop as { role?: string } | null,
      sub as { plan: "basic" | "pro" | "premium"; status: string; trial_end: string | null } | null
    )
    if (!plan) {
      return NextResponse.json(
        { error: "Assinatura não ativa. Escolha um plano." },
        { status: 403 }
      )
    }

    const { count } = await supabase
      .from("barbers")
      .select("*", { count: "exact", head: true })
      .eq("barbershop_id", barbershopId)
    if (!canAddBarber(plan, count ?? 0)) {
      return NextResponse.json(
        { error: getBarberLimitMessage(plan), code: "PLAN_LIMIT" },
        { status: 403 }
      )
    }

    const body = await request.json() as { name: string; phone?: string; commission?: number }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }

    const planForCommission = await fetchEffectivePlanForBarbershop(barbershopId)
    const commissionAllowed = !!(planForCommission && hasFeature(planForCommission, "barber_commission"))
    let commission = body.commission ?? 0
    if (!commissionAllowed) {
      if (body.commission != null && Number(body.commission) !== 0) {
        return NextResponse.json(
          { error: getUpgradeMessage("barber_commission"), code: "PLAN_FEATURE" },
          { status: 403 }
        )
      }
      commission = 0
    } else {
      const c = Number(commission)
      if (!Number.isFinite(c) || c < 0 || c > 100) {
        return NextResponse.json({ error: "Comissão deve ser entre 0 e 100%." }, { status: 400 })
      }
      commission = c
    }

    const { data, error } = await supabase
      .from("barbers")
      .insert({
        barbershop_id: barbershopId,
        name: body.name.trim(),
        phone: body.phone?.trim() ?? null,
        commission,
        active: true,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as Barber)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar barbeiro" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
