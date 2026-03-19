import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getRealBarbershopIdFromRequest } from "@/lib/tenant"
import type { Barbershop } from "@/lib/db/types"
import type { SubscriptionPlan } from "@/lib/db/types"

/** Atualizar barbearia (dados, plano, suspender/ativar, role). Apenas role=super_admin. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json() as {
      name?: string
      email?: string
      phone?: string
      role?: "super_admin" | "admin_barbershop"
      suspended?: boolean
      plan?: SubscriptionPlan
    }

    if (body.name !== undefined || body.email !== undefined || body.phone !== undefined || body.role !== undefined) {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (body.name !== undefined) updates.name = body.name
      if (body.email !== undefined) updates.email = body.email
      if (body.phone !== undefined) updates.phone = body.phone
      if (body.role !== undefined) updates.role = body.role
      if (body.suspended !== undefined) updates.suspended_at = body.suspended ? new Date().toISOString() : null
      const { error: errUp } = await supabase
        .from("barbershops")
        .update(updates)
        .eq("id", id)
      if (errUp) return NextResponse.json({ error: errUp.message }, { status: 500 })
    }

    if (body.plan !== undefined) {
      const { error: errSub } = await supabase
        .from("subscriptions")
        .update({
          plan: body.plan,
          status: "active",
          trial_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq("barbershop_id", id)
      if (errSub) return NextResponse.json({ error: errSub.message }, { status: 500 })
    }

    const { data: updated } = await supabase
      .from("barbershops")
      .select("*")
      .eq("id", id)
      .single()
    return NextResponse.json(updated as Barbershop)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}
