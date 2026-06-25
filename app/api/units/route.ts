import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { BARBERSHOP_UNIT_COOKIE, requireBarbershopId } from "@/lib/tenant"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { hasFeature } from "@/lib/plans"
import {
  migrateLegacyNullAppointmentsToPrincipalUnit,
  repairMissingPrincipalWhenSingleMismatchedUnit,
  seedPrimaryUnitIfNoUnits,
} from "@/lib/barbershop-units-seed"
import { normalizeGoogleMapsUrl } from "@/lib/google-maps-url"
import { barbershopUnitToApi } from "@/lib/barbershop-unit-api"
import { repairPolicyArchivedUnits } from "@/lib/barbershop-units-plan"

function optStr(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === "" ? null : s
}

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    await seedPrimaryUnitIfNoUnits(barbershopId)
    await repairMissingPrincipalWhenSingleMismatchedUnit(barbershopId)
    await migrateLegacyNullAppointmentsToPrincipalUnit(barbershopId)

    const effectivePlan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (effectivePlan) {
      await repairPolicyArchivedUnits(barbershopId)
    }

    const rows = await prisma.barbershopUnit.findMany({
      where: { barbershopId },
      orderBy: { createdAt: "asc" },
    })
    const units = rows.map(barbershopUnitToApi)

    const cookieStore = await cookies()
    const selectedUnitId = cookieStore.get(BARBERSHOP_UNIT_COOKIE)?.value ?? null
    const selectedValid = selectedUnitId != null && units.some((u) => u.id === selectedUnitId)
    if (selectedUnitId != null && !selectedValid) {
      cookieStore.delete(BARBERSHOP_UNIT_COOKIE)
    }

    return NextResponse.json({
      units,
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
      maps_url?: string | null
    }
    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: "Nome da unidade é obrigatório" }, { status: 400 })
    }

    /** Primeira unidade cadastrada na UI: garante a unidade principal (nome da rede) antes da nova filial. */
    const existingCount = await prisma.barbershopUnit.count({ where: { barbershopId } })
    const bs = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { name: true, createdAt: true },
    })
    const principalName = bs?.name?.trim() ?? ""

    if (existingCount === 0 && principalName && name !== principalName) {
      await prisma.barbershopUnit.create({
        data: {
          barbershopId,
          name: principalName,
          active: true,
          createdAt: bs!.createdAt,
        },
      })
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
        mapsUrl: normalizeGoogleMapsUrl(body.maps_url),
        active: true,
        ...(existingCount === 0 && principalName && name === principalName
          ? { createdAt: bs!.createdAt }
          : {}),
      },
    })

    const payload = barbershopUnitToApi(row)
    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar unidade" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

