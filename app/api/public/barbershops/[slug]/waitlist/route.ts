import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getActiveBarbershopBySlug } from "@/lib/public-booking"
import {
  publicClientCookieName,
  verifyPublicClientSession,
} from "@/lib/public-client-session"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import { hasFeature } from "@/lib/plans"
import type { BarbershopSettings } from "@/lib/db/types"
import {
  expireStaleWaitlistNotifications,
  expireOldWaitingItems,
  estimateWaitMinutes,
  getWaitlistAcceptDeadlineMinutes,
  getWaitlistQueuePosition,
} from "@/lib/waitlist-service"
import { waitlistApiInclude, mapWaitingListRowToApi } from "@/lib/waitlist-map"
import type { Prisma } from "@prisma/client"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const shop = await getActiveBarbershopBySlug(slug)
    if (!shop || shop.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    const plan = await resolveEffectivePlanForBarbershop(shop.id)
    if (!plan || !hasFeature(plan, "waiting_list")) {
      return NextResponse.json({ error: "Lista de espera não disponível neste plano." }, { status: 403 })
    }

    await expireStaleWaitlistNotifications(shop.id)
    await expireOldWaitingItems(shop.id)

    const cookieStore = await cookies()
    const rawSession = cookieStore.get(publicClientCookieName(slug))?.value
    const session = verifyPublicClientSession(slug, rawSession)
    if (!session) {
      return NextResponse.json({ items: [] })
    }

    const settings = (shop.settings as BarbershopSettings | null) ?? null
    const acceptMinutes = getWaitlistAcceptDeadlineMinutes(settings)

    const rows = await prisma.waitingListItem.findMany({
      where: {
        barbershopId: shop.id,
        clientId: session.clientId,
        status: { in: ["waiting", "notified", "accepted"] },
      },
      include: waitlistApiInclude,
      orderBy: { createdAt: "desc" },
    })

    const items = []
    for (const row of rows) {
      const api = mapWaitingListRowToApi(row)
      const pos =
        row.status === "waiting" || row.status === "notified"
          ? await getWaitlistQueuePosition({
              barbershopId: shop.id,
              barberId: row.barberId,
              serviceId: row.serviceId,
              itemId: row.id,
            })
          : null
      const dur = row.service?.duration ?? 30
      items.push({
        ...api,
        queue_position: pos?.position ?? null,
        queue_ahead: pos?.ahead ?? null,
        estimated_wait_minutes:
          pos != null ? estimateWaitMinutes(pos.position, dur) : null,
      })
    }

    return NextResponse.json({
      accept_deadline_minutes: acceptMinutes,
      items,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar fila" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const shop = await getActiveBarbershopBySlug(slug)
    if (!shop || shop.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    const plan = await resolveEffectivePlanForBarbershop(shop.id)
    if (!plan || !hasFeature(plan, "waiting_list")) {
      return NextResponse.json({ error: "Lista de espera não disponível neste plano." }, { status: 403 })
    }

    await expireStaleWaitlistNotifications(shop.id)

    const cookieStore = await cookies()
    const rawSession = cookieStore.get(publicClientCookieName(slug))?.value
    const session = verifyPublicClientSession(slug, rawSession)
    if (!session) {
      return NextResponse.json({ error: "Faça login para entrar na fila." }, { status: 401 })
    }

    const body = await request.json() as {
      barber_id?: string
      service_ids?: string[]
      date?: string
      time?: string
      preferred_period?: string | null
    }

    const barberId = String(body.barber_id ?? "").trim()
    const serviceIds = Array.isArray(body.service_ids)
      ? body.service_ids.map((x) => String(x).trim()).filter(Boolean)
      : []
    const dateStr = String(body.date ?? "").trim()
    const timeStr = String(body.time ?? "").trim()

    if (!barberId || !serviceIds.length || !dateStr || !timeStr) {
      return NextResponse.json(
        { error: "barber_id, service_ids, date e time são obrigatórios" },
        { status: 400 }
      )
    }

    const primaryServiceId = serviceIds[0]!
    const extras = serviceIds.slice(1)

    const [barber, clientRow, serviceRow] = await Promise.all([
      prisma.barber.findFirst({ where: { id: barberId, barbershopId: shop.id, active: true }, select: { id: true } }),
      prisma.client.findFirst({ where: { id: session.clientId, barbershopId: shop.id }, select: { id: true } }),
      prisma.service.findFirst({
        where: { id: primaryServiceId, barbershopId: shop.id, active: true },
        select: { id: true },
      }),
    ])

    if (!barber || !clientRow || !serviceRow) {
      return NextResponse.json({ error: "Dados inválidos para a fila" }, { status: 400 })
    }

    if (extras.length) {
      const extraOk = await prisma.service.count({
        where: { barbershopId: shop.id, id: { in: extras }, active: true },
      })
      if (extraOk !== extras.length) {
        return NextResponse.json({ error: "Um dos serviços não está disponível" }, { status: 400 })
      }
    }

    let desiredDate: Date
    try {
      desiredDate = new Date(`${dateStr}T12:00:00`)
      if (Number.isNaN(desiredDate.getTime())) throw new Error("invalid")
    } catch {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 })
    }

    const normalizedTime = timeStr.length >= 5 ? timeStr.slice(0, 5) : timeStr
    const existing = await prisma.waitingListItem.findFirst({
      where: {
        barbershopId: shop.id,
        clientId: session.clientId,
        barberId,
        desiredDate,
        desiredTime: normalizedTime,
        status: { in: ["waiting", "notified"] },
      },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Você já está na lista de espera para este horário." },
        { status: 409 }
      )
    }

    const row = await prisma.waitingListItem.create({
      data: {
        barbershopId: shop.id,
        clientId: session.clientId,
        barberId,
        serviceId: primaryServiceId,
        extraServiceIds: extras as unknown as Prisma.InputJsonValue,
        desiredDate,
        desiredTime: timeStr.length >= 5 ? timeStr.slice(0, 5) : timeStr,
        preferredPeriod: body.preferred_period?.trim() || null,
        priority: 0,
        status: "waiting",
      },
      include: waitlistApiInclude,
    })

    const api = mapWaitingListRowToApi(row)
    const pos = await getWaitlistQueuePosition({
      barbershopId: shop.id,
      barberId,
      serviceId: primaryServiceId,
      itemId: row.id,
    })
    const dur = row.service?.duration ?? 30

    return NextResponse.json({
      item: {
        ...api,
        queue_position: pos?.position ?? 1,
        queue_ahead: pos?.ahead ?? 0,
        estimated_wait_minutes: pos != null ? estimateWaitMinutes(pos.position, dur) : null,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao entrar na fila" },
      { status: 500 }
    )
  }
}
