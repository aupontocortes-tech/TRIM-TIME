import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { BARBERSHOP_UNIT_COOKIE, requireBarbershopId } from "@/lib/tenant"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { hasFeature } from "@/lib/plans"
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

export async function DELETE(
  _request: Request,
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
    const unit = await prisma.barbershopUnit.findFirst({
      where: { id, barbershopId },
    })
    if (!unit) {
      return NextResponse.json({ error: "Unidade não encontrada" }, { status: 404 })
    }

    const totalUnits = await prisma.barbershopUnit.count({ where: { barbershopId } })
    if (totalUnits <= 1) {
      return NextResponse.json(
        { error: "Não é possível excluir a única unidade da barbearia." },
        { status: 400 }
      )
    }

    await prisma.barbershopUnit.delete({ where: { id } })

    const cookieStore = await cookies()
    if (cookieStore.get(BARBERSHOP_UNIT_COOKIE)?.value === id) {
      cookieStore.delete(BARBERSHOP_UNIT_COOKIE)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao excluir unidade" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

