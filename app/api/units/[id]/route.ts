import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { BARBERSHOP_UNIT_COOKIE, requireBarbershopId } from "@/lib/tenant"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { hasFeature } from "@/lib/plans"
import { getPrincipalUnitId } from "@/lib/barbershop-units-plan"
import { normalizeGoogleMapsUrl } from "@/lib/google-maps-url"
import { barbershopUnitToApi } from "@/lib/barbershop-unit-api"

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
      maps_url?: string | null
    }

    if (body.active === false) {
      const principalId = await getPrincipalUnitId(barbershopId)
      if (principalId === id) {
        return NextResponse.json(
          { error: "A unidade principal não pode ser arquivada." },
          { status: 400 }
        )
      }
    }

    const updates: {
      name?: string
      active?: boolean
      phone?: string | null
      address?: string | null
      city?: string | null
      state?: string | null
      cep?: string | null
      mapsUrl?: string | null
    } = {}

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.active !== undefined) updates.active = body.active
    if (body.phone !== undefined) updates.phone = optStr(body.phone)
    if (body.address !== undefined) updates.address = optStr(body.address)
    if (body.city !== undefined) updates.city = optStr(body.city)
    if (body.state !== undefined) updates.state = optStr(body.state)
    if (body.cep !== undefined) updates.cep = optStr(body.cep)
    if (body.maps_url !== undefined) {
      updates.mapsUrl = normalizeGoogleMapsUrl(body.maps_url)
    }

    const row = await prisma.barbershopUnit.updateMany({
      where: { id, barbershopId },
      data: updates,
    })
    if (row.count === 0) {
      return NextResponse.json({ error: "Unidade não encontrada" }, { status: 404 })
    }

    const updated = await prisma.barbershopUnit.findFirst({
      where: { id, barbershopId },
    })
    if (!updated) {
      return NextResponse.json({ error: "Unidade não encontrada" }, { status: 404 })
    }

    return NextResponse.json(barbershopUnitToApi(updated))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar unidade" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

/** Unidades não são apagadas do banco — use PATCH { active: false } para arquivar. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params
  return NextResponse.json(
    {
      error:
        "Unidades não podem ser excluídas permanentemente. Use Arquivar para ocultar do app do cliente; nome, barbeiros e clientes permanecem salvos.",
    },
    { status: 403 }
  )
}
