import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { BARBERSHOP_UNIT_COOKIE, requireBarbershopId } from "@/lib/tenant"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { hasFeature } from "@/lib/plans"
import type { BarbershopUnit } from "@/lib/db/types"

function optStr(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === "" ? null : s
}

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("barbershop_units")
      .select("*")
      .eq("barbershop_id", barbershopId)
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const cookieStore = await cookies()
    const selectedUnitId = cookieStore.get(BARBERSHOP_UNIT_COOKIE)?.value ?? null
    const selectedValid = selectedUnitId != null && (data ?? []).some((u) => u.id === selectedUnitId)
    if (selectedUnitId != null && !selectedValid) {
      cookieStore.delete(BARBERSHOP_UNIT_COOKIE)
    }

    return NextResponse.json({
      units: (data ?? []) as BarbershopUnit[],
      selected_unit_id: selectedValid ? selectedUnitId : null,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao buscar unidades" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const effectivePlan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!effectivePlan || !hasFeature(effectivePlan, "multi_units")) {
      return NextResponse.json(
        { error: "Multiunidade disponível apenas no plano Premium." },
        { status: 403 }
      )
    }
    const body = (await request.json()) as {
      name?: string
      phone?: string | null
      address?: string | null
      city?: string | null
      state?: string | null
      cep?: string | null
    }
    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: "Nome da unidade é obrigatório" }, { status: 400 })
    }

    /** Prisma aplica `created_at` / `updated_at`; insert direto no Supabase omitia timestamps e quebrava NOT NULL no Postgres. */
    const row = await prisma.barbershopUnit.create({
      data: {
        barbershopId,
        name,
        phone: optStr(body.phone),
        address: optStr(body.address),
        city: optStr(body.city),
        state: optStr(body.state),
        cep: optStr(body.cep),
        active: true,
      },
    })

    const payload: BarbershopUnit = {
      id: row.id,
      barbershop_id: row.barbershopId,
      name: row.name,
      phone: row.phone,
      address: row.address,
      city: row.city,
      state: row.state,
      cep: row.cep,
      active: row.active,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }
    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar unidade" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

