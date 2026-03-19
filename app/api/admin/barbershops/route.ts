import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getRealBarbershopIdFromRequest } from "@/lib/tenant"
import type { Barbershop } from "@/lib/db/types"

/** Lista todas as barbearias. Apenas role=super_admin. */
export async function GET() {
  try {
    const barbershopId = await getRealBarbershopIdFromRequest()
    if (!barbershopId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const supabase = createServiceRoleClient()
    const { data: me } = await supabase
      .from("barbershops")
      .select("role")
      .eq("id", barbershopId)
      .single()
    if (me?.role !== "super_admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 })

    const { data, error } = await supabase
      .from("barbershops")
      .select("id, name, email, phone, slug, role, suspended_at, created_at")
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ids = (data ?? []).map((b) => b.id)
    if (ids.length === 0) return NextResponse.json(data ?? [])

    const { data: subs } = await supabase
      .from("subscriptions")
      .select("barbershop_id, plan, status")
      .in("barbershop_id", ids)
    const subByBarbershop = new Map((subs ?? []).map((s) => [s.barbershop_id, s]))

    const list = (data ?? []).map((b) => ({
      ...b,
      subscription: subByBarbershop.get(b.id) ?? null,
    }))
    return NextResponse.json(list)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}
