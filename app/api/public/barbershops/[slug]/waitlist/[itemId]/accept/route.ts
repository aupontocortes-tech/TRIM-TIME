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
  getWaitlistAcceptDeadlineMinutes,
  normalizeWaitlistTime,
  parseExtraServiceIds,
} from "@/lib/waitlist-service"
import { utcDayRangeForYmd, parseAppointmentDate } from "@/lib/appointment-prisma-helpers"
import { expireStaleAppointmentsForBarbershop } from "@/lib/appointment-expiry"
import { clientHasBlockingAppointmentOnDay } from "@/lib/client-same-day-appointment"
import { normalizeAppointmentTime } from "@/lib/scheduling"
import { trySendWhatsAppAppointmentConfirmation } from "@/lib/whatsapp-appointment-events"
import { trySendEmailAppointmentConfirmation } from "@/lib/email-appointment-events"
import { trySendPushAppointmentConfirmation } from "@/lib/push-appointment-events"

function addMinutesClock(time: string, minutes: number): string {
  const raw = normalizeAppointmentTime(time)
  const [hh, mm] = raw.split(":").map((v) => Number(v))
  const total = hh * 60 + mm + minutes
  const outH = Math.floor(total / 60)
  const outM = total % 60
  return `${String(outH).padStart(2, "0")}:${String(outM).padStart(2, "0")}`
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string; itemId: string }> }
) {
  try {
    const { slug, itemId } = await params
    const shop = await getActiveBarbershopBySlug(slug)
    if (!shop || shop.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    await expireStaleAppointmentsForBarbershop(shop.id)

    const plan = await resolveEffectivePlanForBarbershop(shop.id)
    if (!plan || !hasFeature(plan, "waiting_list")) {
      return NextResponse.json({ error: "Lista de espera não disponível neste plano." }, { status: 403 })
    }

    await expireStaleWaitlistNotifications(shop.id)

    const cookieStore = await cookies()
    const rawSession = cookieStore.get(publicClientCookieName(slug))?.value
    const session = verifyPublicClientSession(slug, rawSession)
    if (!session) {
      return NextResponse.json({ error: "Faça login para confirmar o horário." }, { status: 401 })
    }

    const settings = (shop.settings as BarbershopSettings | null) ?? null
    const deadlineMin = getWaitlistAcceptDeadlineMinutes(settings)

    const entry = await prisma.waitingListItem.findFirst({
      where: { id: itemId, barbershopId: shop.id, clientId: session.clientId },
      include: { service: true },
    })

    if (!entry) {
      return NextResponse.json({ error: "Pedido na fila não encontrado" }, { status: 404 })
    }

    if (entry.status !== "notified") {
      return NextResponse.json({ error: "Não há vaga disponível para confirmar neste momento." }, { status: 400 })
    }

    if (!entry.notifiedAt || !entry.offeredDate || !entry.offeredTime) {
      return NextResponse.json({ error: "Oferta de horário incompleta. Aguarde nova notificação." }, { status: 400 })
    }

    const elapsed = Date.now() - entry.notifiedAt.getTime()
    if (elapsed > deadlineMin * 60_000) {
      return NextResponse.json(
        { error: `O prazo de ${deadlineMin} minutos para aceitar expirou.` },
        { status: 410 }
      )
    }

    const dateYmd = `${entry.offeredDate.getFullYear()}-${String(entry.offeredDate.getMonth() + 1).padStart(2, "0")}-${String(entry.offeredDate.getDate()).padStart(2, "0")}`
    const startTime = normalizeWaitlistTime(String(entry.offeredTime ?? ""))

    const primaryId = entry.serviceId
    const extras = parseExtraServiceIds(entry.extraServiceIds as never)
    const orderedIds = [primaryId, ...extras]

    const services = await prisma.service.findMany({
      where: { barbershopId: shop.id, id: { in: orderedIds }, active: true },
      select: { id: true, duration: true, price: true },
    })
    if (services.length !== orderedIds.length) {
      return NextResponse.json({ error: "Serviço não disponível" }, { status: 400 })
    }

    const orderedServices = orderedIds
      .map((id) => services.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => !!s)

    const times = orderedServices.map((service, index) => {
      const minutesBefore = orderedServices.slice(0, index).reduce((sum, item) => sum + item.duration, 0)
      return { service, time: addMinutesClock(startTime, minutesBefore) }
    })

    const apptDayBounds = utcDayRangeForYmd(dateYmd)
    const existingSameDay = await clientHasBlockingAppointmentOnDay({
      barbershopId: shop.id,
      clientId: session.clientId,
      dayBounds: apptDayBounds,
    })
    if (existingSameDay) {
      return NextResponse.json(
        { error: "Você já possui um agendamento neste dia." },
        { status: 409 }
      )
    }

    const conflicts = await prisma.appointment.findMany({
      where: {
        barbershopId: shop.id,
        barberId: entry.barberId,
        date: { gte: apptDayBounds.gte, lt: apptDayBounds.lt },
        status: { in: ["pending", "confirmed"] },
        time: { in: times.map((item) => item.time) },
      },
      select: { time: true },
    })
    if (conflicts.length > 0) {
      return NextResponse.json(
        { error: "Este horário já foi preenchido. Aguarde nova vaga." },
        { status: 409 }
      )
    }

    const activeUnits = await prisma.barbershopUnit.findMany({
      where: { barbershopId: shop.id, active: true },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    let effectiveUnitId: string | null = null
    if (activeUnits.length === 1) {
      effectiveUnitId = activeUnits[0]!.id
    } else if (activeUnits.length > 1) {
      return NextResponse.json(
        { error: "A barbearia tem várias unidades; confirme pelo balcão ou escolha unidade no app." },
        { status: 400 }
      )
    }

    const apptDate = parseAppointmentDate(dateYmd)

    const created = await prisma.$transaction(async (tx) => {
      const inserted = await Promise.all(
        times.map((item) =>
          tx.appointment.create({
            data: {
              barbershopId: shop.id,
              clientId: session.clientId,
              barberId: entry.barberId,
              serviceId: item.service.id,
              unitId: effectiveUnitId,
              date: apptDate,
              time: normalizeAppointmentTime(item.time),
              status: "confirmed",
              totalPrice: item.service.price,
            },
            select: { id: true },
          })
        )
      )

      await tx.waitingListItem.update({
        where: { id: entry.id },
        data: {
          status: "accepted",
          acceptedAt: new Date(),
        },
      })

      return inserted
    })

    if (created.length > 0) {
      void trySendWhatsAppAppointmentConfirmation(shop.id, created[0]!.id)
      void trySendEmailAppointmentConfirmation(shop.id, created[0]!.id)
      void trySendPushAppointmentConfirmation(shop.id, created[0]!.id)
    }

    return NextResponse.json({
      ok: true,
      appointment_ids: created.map((c) => c.id),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao confirmar" },
      { status: 500 }
    )
  }
}
