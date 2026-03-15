import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { getEffectivePlanForBarbershop } from "@/lib/subscription"
import type { WaitingListItem } from "@/lib/db/types"

export async function GET(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const supabase = createServiceRoleClient()
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status, trial_end")
      .eq("barbershop_id", barbershopId)
      .single()
    const plan = getEffectivePlan(sub as { plan: "basic" | "pro" | "premium"; status: string; trial_end: string | null } | null)
    if (!plan || !hasFeature(plan, "waiting_list")) {
      return NextResponse.json(
        { error: getUpgradeMessage("waiting_list") },
        { status: 403 }
      )
    }
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    let query = supabase
      .from("waiting_list")
      .select("*, client:clients(*), service:services(*)")
      .eq("barbershop_id", barbershopId)
      .order("created_at", { ascending: true })
    if (status) query = query.eq("status", status)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as WaitingListItem[])
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
    if (!plan || !hasFeature(plan, "waiting_list")) {
      return NextResponse.json(
        { error: getUpgradeMessage("waiting_list") },
        { status: 403 }
      )
    }
    const body = await request.json() as {
      client_id: string
      service_id: string
      desired_date?: string
      desired_time?: string
    }
    if (!body.client_id || !body.service_id) {
      return NextResponse.json(
        { error: "client_id e service_id são obrigatórios" },
        { status: 400 }
      )
    }
    const { data, error } = await supabase
      .from("waiting_list")
      .insert({
        barbershop_id: barbershopId,
        client_id: body.client_id,
        service_id: body.service_id,
        desired_date: body.desired_date ?? null,
        desired_time: body.desired_time ?? null,
        status: "waiting",
      })
      .select("*, client:clients(*), service:services(*)")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as WaitingListItem)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao entrar na lista de espera" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
