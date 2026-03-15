import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { getEffectivePlanForBarbershop } from "@/lib/subscription"
import type { Service } from "@/lib/db/types"

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("barbershop_id", barbershopId)
      .order("name")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as Service[])
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
    if (!plan || !hasFeature(plan, "services_prices")) {
      return NextResponse.json(
        { error: getUpgradeMessage("services_prices") },
        { status: 403 }
      )
    }
    const body = await request.json() as { name: string; price: number; duration?: number }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }
    const price = Number(body.price)
    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: "Preço inválido" }, { status: 400 })
    }
    const { data, error } = await supabase
      .from("services")
      .insert({
        barbershop_id: barbershopId,
        name: body.name.trim(),
        price,
        duration: Math.max(1, Number(body.duration) || 30),
        active: true,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as Service)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar serviço" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
