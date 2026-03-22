import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireBarbershopId } from "@/lib/tenant"
import type { Barber } from "@/lib/db/types"
import { fetchBarbershopPlanContext } from "@/lib/barbershop-plan-server"
import { canUseBarberCommission, getUpgradeMessage } from "@/lib/plans"

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    const body = await _request.json() as Partial<Pick<Barber, "name" | "phone" | "commission" | "active">>
    const supabase = createServiceRoleClient()

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (body.name !== undefined) {
      const n = String(body.name).trim()
      if (!n) return NextResponse.json({ error: "Nome não pode ser vazio." }, { status: 400 })
      update.name = n
    }
    if (body.phone !== undefined) update.phone = body.phone?.trim() || null
    if (body.active !== undefined) update.active = Boolean(body.active)

    if (body.commission !== undefined) {
      const { plan, barbershopRole } = await fetchBarbershopPlanContext(barbershopId)
      const allowed = canUseBarberCommission(plan, barbershopRole)
      const c = Number(body.commission)
      if (!allowed) {
        if (c !== 0) {
          return NextResponse.json(
            { error: getUpgradeMessage("barber_commission"), code: "PLAN_FEATURE" },
            { status: 403 }
          )
        }
        update.commission = 0
      } else {
        if (!Number.isFinite(c) || c < 0 || c > 100) {
          return NextResponse.json({ error: "Comissão deve ser entre 0 e 100%." }, { status: 400 })
        }
        update.commission = c
      }
    }

    const { data, error } = await supabase
      .from("barbers")
      .update(update)
      .eq("id", id)
      .eq("barbershop_id", barbershopId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 })
    return NextResponse.json(data as Barber)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    const supabase = createServiceRoleClient()
    const { error } = await supabase
      .from("barbers")
      .delete()
      .eq("id", id)
      .eq("barbershop_id", barbershopId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao excluir" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
