import { prisma } from "@/lib/prisma"
import type { BarbershopSettings } from "@/lib/db/types"
import {
  expireStaleWaitlistNotifications,
  getWaitlistAcceptDeadlineMinutes,
  normalizeWaitlistTime,
  parseExtraServiceIds,
} from "@/lib/waitlist-service"
import { utcDayRangeForYmd, parseAppointmentDate } from "@/lib/appointment-prisma-helpers"
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

export type WaitlistAcceptResult =
  | { ok: true; appointmentIds: string[] }
  | { ok: false; status: number; error: string }

export async function acceptWaitlistOffer(args: {
  barbershopId: string
  itemId: string
  clientId: string
  settings: BarbershopSettings | null
}): Promise<WaitlistAcceptResult> {
  const { barbershopId, itemId, clientId, settings } = args

  await expireStaleWaitlistNotifications(barbershopId)

  const deadlineMin = getWaitlistAcceptDeadlineMinutes(settings)

  const entry = await prisma.waitingListItem.findFirst({
    where: { id: itemId, barbershopId, clientId },
    include: { service: true },
  })

  if (!entry) {
    return { ok: false, status: 404, error: "Pedido na fila não encontrado" }
  }

  if (entry.status !== "notified") {
    return { ok: false, status: 400, error: "Não há vaga disponível para confirmar neste momento." }
  }

  if (!entry.notifiedAt || !entry.offeredDate || !entry.offeredTime) {
    return { ok: false, status: 400, error: "Oferta de horário incompleta. Aguarde nova notificação." }
  }

  const elapsed = Date.now() - entry.notifiedAt.getTime()
  if (elapsed > deadlineMin * 60_000) {
    return {
      ok: false,
      status: 410,
      error: `O prazo de ${deadlineMin} minutos para aceitar expirou.`,
    }
  }

  const dateYmd = `${entry.offeredDate.getFullYear()}-${String(entry.offeredDate.getMonth() + 1).padStart(2, "0")}-${String(entry.offeredDate.getDate()).padStart(2, "0")}`
  const startTime = normalizeWaitlistTime(String(entry.offeredTime ?? ""))

  const primaryId = entry.serviceId
  const extras = parseExtraServiceIds(entry.extraServiceIds as never)
  const orderedIds = [primaryId, ...extras]

  const services = await prisma.service.findMany({
    where: { barbershopId, id: { in: orderedIds }, active: true },
    select: { id: true, duration: true, price: true },
  })
  if (services.length !== orderedIds.length) {
    return { ok: false, status: 400, error: "Serviço não disponível" }
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
    barbershopId,
    clientId,
    dayBounds: apptDayBounds,
  })
  if (existingSameDay) {
    return { ok: false, status: 409, error: "Você já possui um agendamento neste dia." }
  }

  const conflicts = await prisma.appointment.findMany({
    where: {
      barbershopId,
      barberId: entry.barberId,
      date: { gte: apptDayBounds.gte, lt: apptDayBounds.lt },
      status: { in: ["pending", "confirmed"] },
      time: { in: times.map((item) => item.time) },
    },
    select: { time: true },
  })
  if (conflicts.length > 0) {
    return { ok: false, status: 409, error: "Este horário já foi preenchido. Aguarde nova vaga." }
  }

  const activeUnits = await prisma.barbershopUnit.findMany({
    where: { barbershopId, active: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })
  let effectiveUnitId: string | null = null
  if (activeUnits.length === 1) {
    effectiveUnitId = activeUnits[0]!.id
  } else if (activeUnits.length > 1) {
    return {
      ok: false,
      status: 400,
      error: "A barbearia tem várias unidades; confirme pelo balcão ou escolha unidade no app.",
    }
  }

  const apptDate = parseAppointmentDate(dateYmd)

  const created = await prisma.$transaction(async (tx) => {
    const inserted = await Promise.all(
      times.map((item) =>
        tx.appointment.create({
          data: {
            barbershopId,
            clientId,
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
    await trySendWhatsAppAppointmentConfirmation(barbershopId, created[0]!.id)
    void trySendEmailAppointmentConfirmation(barbershopId, created[0]!.id)
    void trySendPushAppointmentConfirmation(barbershopId, created[0]!.id)
  }

  return { ok: true, appointmentIds: created.map((c) => c.id) }
}
