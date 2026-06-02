import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { canAddBarber, canUseBarberCommission, getBarberLimitMessage, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { prisma } from "@/lib/prisma"
import { prismaBarberCreateWithPhotoPositionFallback } from "@/lib/barber-mutations"
import { fetchBarberPhotoPositionsByBarbershopId, fetchBarberPhotoScalesByBarbershopId } from "@/lib/barber-queries"
import { clampPhotoPosition, clampPhotoScale } from "@/lib/barber-photo-style"
import type { Barber } from "@/lib/db/types"
import { assertValidProfilePhotoDataUrl } from "@/lib/photo-data-url"
import { withBarbersUnitSchema } from "@/lib/barber-unit-schema"
import {
  assignBarbersWithoutUnit,
  assignOrphanBarbersToPrincipalUnit,
} from "@/lib/barbershop-units-seed"
import {
  barbershopHasMultipleUnits,
  prismaBarberUnitFilter,
  requireSelectedUnitForBarberCreate,
  resolveBarberListUnitId,
} from "@/lib/unit-context"

function mapBarberRow(
  b: {
    id: string
    barbershopId: string
    unitId: string | null
    name: string
    phone: string | null
    email: string | null
    cpf: string | null
    photoUrl: string | null
    commission: { toString(): string } | number
    active: boolean
    role: string
    portalToken: string | null
    createdAt: Date
    updatedAt: Date
    photoPosition?: number
    photoScale?: number
  },
  positions: Map<string, number>,
  scales: Map<string, number>
): Barber {
  const pt = b.portalToken ?? null
  return {
    id: b.id,
    barbershop_id: b.barbershopId,
    unit_id: b.unitId,
    name: b.name,
    phone: b.phone,
    email: b.email,
    cpf: b.cpf,
    photo_url: b.photoUrl,
    photo_position: positions.get(b.id) ?? b.photoPosition ?? 50,
    photo_scale: scales.get(b.id) ?? b.photoScale ?? 100,
    commission: Number(b.commission),
    active: b.active,
    role: b.role as Barber["role"],
    portal_token: pt,
    app_profissional_path: pt ? `/profissional/${pt}` : null,
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  }
}

export async function GET(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const queryUnit = new URL(request.url).searchParams.get("unit_id")

    const payload = await withBarbersUnitSchema(async () => {
      await assignBarbersWithoutUnit(barbershopId)
      await assignOrphanBarbersToPrincipalUnit(barbershopId)

      const multiUnit = await barbershopHasMultipleUnits(barbershopId)

      const selectedUnitId = await resolveBarberListUnitId(barbershopId, queryUnit)
      if (multiUnit && queryUnit?.trim() && !selectedUnitId) {
        return []
      }
      const unitFilter = prismaBarberUnitFilter(selectedUnitId)
      let data = await prisma.barber.findMany({
        where: { barbershopId, ...unitFilter },
        orderBy: { name: "asc" },
      })
      if (selectedUnitId) {
        data = data.filter((b) => b.unitId === selectedUnitId)
      }
      const missingPortal = data.filter((b) => !b.portalToken)
      if (missingPortal.length > 0) {
        await Promise.all(
          missingPortal.map((b) =>
            prisma.barber.update({ where: { id: b.id }, data: { portalToken: randomUUID() } })
          )
        )
        data = await prisma.barber.findMany({
          where: { barbershopId, ...unitFilter },
          orderBy: { name: "asc" },
        })
        if (selectedUnitId) {
          data = data.filter((b) => b.unitId === selectedUnitId)
        }
      }
      let positions = new Map<string, number>()
      let scales = new Map<string, number>()
      try {
        positions = await fetchBarberPhotoPositionsByBarbershopId(barbershopId)
        scales = await fetchBarberPhotoScalesByBarbershopId(barbershopId)
      } catch {
        /* coluna/tabela inacessível via SQL: usa só o Prisma */
      }
      return data.map((b) => mapBarberRow(b, positions, scales))
    })

    return NextResponse.json(payload)
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
    const [plan, currentCount] = await Promise.all([
      resolveEffectivePlanForActiveSession(barbershopId),
      prisma.barber.count({ where: { barbershopId } }),
    ])
    if (!plan) {
      return NextResponse.json(
        { error: "Assinatura não ativa. Escolha um plano." },
        { status: 403 }
      )
    }
    if (!canAddBarber(plan, currentCount)) {
      return NextResponse.json(
        { error: getBarberLimitMessage(plan), code: "PLAN_LIMIT" },
        { status: 403 }
      )
    }

    const body = await request.json() as {
      name: string
      phone?: string
      email?: string
      cpf?: string
      photo_url?: string | null
      photo_position?: number
      photo_scale?: number
      commission?: number
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }
    const phoneTrim = String(body.phone ?? "").trim()
    if (!phoneTrim) {
      return NextResponse.json({ error: "Telefone é obrigatório" }, { status: 400 })
    }

    let photoUrl: string | null = null
    try {
      photoUrl = assertValidProfilePhotoDataUrl(body.photo_url ?? null)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Foto inválida" },
        { status: 400 }
      )
    }
    const cpfDigitsOnly = String(body.cpf ?? "").replace(/\D/g, "")
    const cpfNorm: string | null = cpfDigitsOnly.length >= 11 ? cpfDigitsOnly.slice(0, 11) : null
    const emailTrim = body.email?.trim().toLowerCase() || null

    const commissionAllowed = canUseBarberCommission(plan)
    let commission = body.commission ?? 0
    if (!commissionAllowed) {
      if (body.commission != null && Number(body.commission) !== 0) {
        return NextResponse.json(
          { error: getUpgradeMessage("barber_commission"), code: "PLAN_FEATURE" },
          { status: 403 }
        )
      }
      commission = 0
    } else {
      const c = Number(commission)
      if (!Number.isFinite(c) || c < 0 || c > 100) {
        return NextResponse.json({ error: "Comissão deve ser entre 0 e 100%." }, { status: 400 })
      }
      commission = c
    }

    const { unitId, error: unitError } = await requireSelectedUnitForBarberCreate(barbershopId)
    if (unitError) {
      return NextResponse.json({ error: unitError }, { status: 400 })
    }

    const photoPosition = clampPhotoPosition(Number(body.photo_position ?? 50))
    const photoScale = clampPhotoScale(Number(body.photo_scale ?? 100))
    const created = await withBarbersUnitSchema(() =>
      prismaBarberCreateWithPhotoPositionFallback({
        barbershopId,
        unitId,
        name: body.name.trim(),
        phone: phoneTrim,
        email: emailTrim,
        cpf: cpfNorm,
        photoUrl,
        photoPosition,
        photoScale,
        commission,
        active: true,
        portalToken: randomUUID(),
      })
    )
    return NextResponse.json(mapBarberRow(created, new Map([[created.id, created.photoPosition ?? 50]]), new Map([[created.id, photoScale]])))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar barbeiro" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
