import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireBarbershopId } from "@/lib/tenant"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { hasFeature } from "@/lib/plans"
import type { BarbershopUnit } from "@/lib/db/types"

function optStr(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === "" ? null : s
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const effectivePlan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!effectivePlan || !hasFeature(effectivePlan, "multi_units")) {
      return NextResponse.json(
        { error: "Multiunidade disponível apenas no plano Premium." },
        { status: 403 }
      )
    }
    const { id } = await params
    const body = (await request.json()) as {
      name?: string
      active?: boolean
      phone?: string | null
      address?: string | null
      city?: string | null
      state?: string | null
      cep?: string | null
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.active !== undefined) updates.active = body.active
    if (body.phone !== undefined) updates.phone = optStr(body.phone)
    if (body.address !== undefined) updates.address = optStr(body.address)
    if (body.city !== undefined) updates.city = optStr(body.city)
    if (body.state !== undefined) updates.state = optStr(body.state)
    if (body.cep !== undefined) updates.cep = optStr(body.cep)

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("barbershop_units")
      .update(updates)
      .eq("id", id)
      .eq("barbershop_id", barbershopId)
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as BarbershopUnit)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar unidade" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

