import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getBarbershopIdFromRequest } from "@/lib/tenant"
import { createTrialEndDate } from "@/lib/subscription"
import type { Subscription } from "@/lib/db/types"

export async function GET() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json(
        { error: "Barbershop não identificada" },
        { status: 401 }
      )
    }
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("barbershop_id", barbershopId)
      .single()
    if (error) {
      if (error.code === "PGRST116") return NextResponse.json(null, { status: 404 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data as Subscription)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao buscar assinatura" },
      { status: 500 }
    )
  }
}

/** Escolher plano (após trial ou nova assinatura) */
export async function POST(request: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json(
        { error: "Barbershop não identificada" },
        { status: 401 }
      )
    }
    const body = await request.json() as { plan: Subscription["plan"] }
    const plan = body.plan
    if (!plan || !["basic", "pro", "premium"].includes(plan)) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 })
    }
    const supabase = createServiceRoleClient()
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("barbershop_id", barbershopId)
      .single()
    if (existing) {
      const { data, error } = await supabase
        .from("subscriptions")
        .update({
          plan,
          status: "active",
          trial_end: null,
          next_payment: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("barbershop_id", barbershopId)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data as Subscription)
    }
    const trialEnd = createTrialEndDate()
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        barbershop_id: barbershopId,
        plan: "premium",
        status: "trial",
        trial_end: trialEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as Subscription)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar/atualizar assinatura" },
      { status: 500 }
    )
  }
}
