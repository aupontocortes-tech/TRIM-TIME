import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { maintainWaitlist } from "@/lib/waitlist-service"
import { waitlistApiInclude, mapWaitingListRowToApi } from "@/lib/waitlist-map"
import {
  type WaitlistView,
  waitlistActiveOrderBy,
  waitlistHistoryOrderBy,
  waitlistWhereForView,
} from "@/lib/waitlist-query"
import { prismaWaitlistUnitFilter, resolveSelectedUnitId } from "@/lib/unit-context"
import type { Prisma, WaitingListStatus } from "@prisma/client"

const WAITLIST_STATUS_FILTERS = new Set<string>(["waiting", "notified", "accepted", "expired", "canceled"])
const WAITLIST_VIEWS = new Set<string>(["active", "history", "all"])

export async function GET(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "waiting_list")) {
      return NextResponse.json({ error: getUpgradeMessage("waiting_list") }, { status: 403 })
    }
    await maintainWaitlist(barbershopId)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")?.trim()
    const viewParam = searchParams.get("view")?.trim() ?? "active"
    const view: WaitlistView = WAITLIST_VIEWS.has(viewParam) ? (viewParam as WaitlistView) : "active"

    const selectedUnitId = await resolveSelectedUnitId(barbershopId)
    const where: Prisma.WaitingListItemWhereInput = {
      ...waitlistWhereForView(barbershopId, view),
      ...prismaWaitlistUnitFilter(selectedUnitId),
    }
    if (status && WAITLIST_STATUS_FILTERS.has(status)) {
      where.status = status as WaitingListStatus
    }

    const orderBy =
      view === "history" ? waitlistHistoryOrderBy : view === "active" ? waitlistActiveOrderBy : [{ createdAt: "desc" as const }]

    const rows = await prisma.waitingListItem.findMany({
      where,
      include: waitlistApiInclude,
      orderBy,
    })

    return NextResponse.json(rows.map(mapWaitingListRowToApi))
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
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "waiting_list")) {
      return NextResponse.json({ error: getUpgradeMessage("waiting_list") }, { status: 403 })
    }

    const body = await request.json() as {
      client_id?: string
      barber_id?: string
      service_id?: string
      extra_service_ids?: string[]
      desired_date?: string | null
      desired_time?: string | null
      preferred_period?: string | null
      priority?: number
    }

    const clientId = String(body.client_id ?? "").trim()
    const barberId = String(body.barber_id ?? "").trim()
    const serviceId = String(body.service_id ?? "").trim()

    if (!clientId || !barberId || !serviceId) {
      return NextResponse.json(
        { error: "client_id, barber_id e service_id são obrigatórios" },
        { status: 400 }
      )
    }

    const selectedUnitId = await resolveSelectedUnitId(barbershopId)

    const [barber, clientRow, serviceRow] = await Promise.all([
      prisma.barber.findFirst({
        where: { id: barberId, barbershopId, active: true },
        select: { id: true, unitId: true },
      }),
      prisma.client.findFirst({ where: { id: clientId, barbershopId }, select: { id: true } }),
      prisma.service.findFirst({ where: { id: serviceId, barbershopId, active: true }, select: { id: true } }),
    ])

    if (!barber || !clientRow || !serviceRow) {
      return NextResponse.json({ error: "Cliente, barbeiro ou serviço inválido" }, { status: 400 })
    }

    const activeUnitCount = await prisma.barbershopUnit.count({
      where: { barbershopId, active: true },
    })
    if (activeUnitCount > 1 && selectedUnitId && barber.unitId && barber.unitId !== selectedUnitId) {
      return NextResponse.json(
        { error: "Este profissional não atende na unidade selecionada." },
        { status: 400 }
      )
    }

    const extras = Array.isArray(body.extra_service_ids)
      ? body.extra_service_ids.map((x) => String(x).trim()).filter(Boolean)
      : []

    let desiredDate: Date | null = null
    if (body.desired_date && String(body.desired_date).trim()) {
      try {
        desiredDate = new Date(`${String(body.desired_date).trim()}T12:00:00`)
        if (Number.isNaN(desiredDate.getTime())) desiredDate = null
      } catch {
        desiredDate = null
      }
    }

    const row = await prisma.waitingListItem.create({
      data: {
        barbershopId,
        clientId,
        barberId,
        serviceId,
        extraServiceIds: extras as unknown as Prisma.InputJsonValue,
        desiredDate,
        desiredTime: body.desired_time?.trim() || null,
        preferredPeriod: body.preferred_period?.trim() || null,
        priority: typeof body.priority === "number" && Number.isFinite(body.priority) ? Math.round(body.priority) : 0,
        status: "waiting",
      },
      include: waitlistApiInclude,
    })

    return NextResponse.json(mapWaitingListRowToApi(row))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao entrar na lista de espera" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
