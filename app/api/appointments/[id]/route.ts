import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasBarberSlotConflict } from "@/lib/scheduling"
import { saleCommissionAmount } from "@/lib/commissions"
import { resolveSelectedUnitId } from "@/lib/unit-context"
import type { Appointment, AppointmentStatus } from "@/lib/db/types"
import { prisma } from "@/lib/prisma"
import {
  appointmentApiInclude,
  mapAppointmentRowToApi,
  parseAppointmentDate,
} from "@/lib/appointment-prisma-helpers"
import { withServiceDescriptionsFromDb } from "@/lib/service-queries"
import { normalizeAppointmentTime } from "@/lib/scheduling"
import { trySendWhatsAppAppointmentPostService } from "@/lib/whatsapp-appointment-events"

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    const body = await _request.json() as {
      status?: AppointmentStatus
      total_price?: number
      date?: string
      time?: string
      barber_id?: string
      service_id?: string
    }
    const selectedUnitId = await resolveSelectedUnitId(barbershopId)

    const before = await prisma.appointment.findFirst({
      where: {
        id,
        barbershopId,
        ...(selectedUnitId ? { unitId: selectedUnitId } : {}),
      },
      include: appointmentApiInclude,
    })
    if (!before) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 })
    }

    const beforeApi = mapAppointmentRowToApi(before)
    const nextDate = body.date ?? beforeApi.date
    const nextTime = body.time ?? beforeApi.time
    const nextBarberId = body.barber_id ?? beforeApi.barber_id

    if (
      body.date !== undefined ||
      body.time !== undefined ||
      body.barber_id !== undefined
    ) {
      const conflict = await hasBarberSlotConflict({
        barbershopId,
        barberId: nextBarberId,
        date: nextDate,
        time: nextTime,
        excludeAppointmentId: id,
      })
      if (conflict) {
        return NextResponse.json(
          { error: "Este horário já está ocupado para o barbeiro escolhido." },
          { status: 409 }
        )
      }
    }

    const finalPrice =
      body.total_price !== undefined
        ? Number(body.total_price)
        : Number(beforeApi.total_price) || 0

    let commissionPercent: number | undefined
    let commissionAmount: number | undefined
    if (body.status === "completed" && beforeApi.status !== "completed") {
      const barber = await prisma.barber.findFirst({
        where: { id: nextBarberId, barbershopId },
        select: { commission: true },
      })
      const pct = Number(barber?.commission) || 0
      commissionPercent = pct
      commissionAmount = saleCommissionAmount(finalPrice, pct)
    }

    const patch: {
      status?: AppointmentStatus
      totalPrice?: number
      date?: Date
      time?: string
      barberId?: string
      serviceId?: string
      commissionPercent?: number
      commissionAmount?: number
    } = {}
    if (body.status !== undefined) patch.status = body.status
    if (body.total_price !== undefined) patch.totalPrice = body.total_price
    if (body.date !== undefined) patch.date = parseAppointmentDate(body.date)
    if (body.time !== undefined) patch.time = normalizeAppointmentTime(body.time)
    if (body.barber_id !== undefined) patch.barberId = body.barber_id
    if (body.service_id !== undefined) patch.serviceId = body.service_id
    if (commissionPercent !== undefined) patch.commissionPercent = commissionPercent
    if (commissionAmount !== undefined) patch.commissionAmount = commissionAmount

    const unitFilter = selectedUnitId ? { unitId: selectedUnitId } : {}
    const { count } = await prisma.appointment.updateMany({
      where: { id, barbershopId, ...unitFilter },
      data: patch,
    })
    if (count === 0) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 })
    }

    const updated = await prisma.appointment.findFirstOrThrow({
      where: { id, barbershopId },
      include: appointmentApiInclude,
    })
    const data = mapAppointmentRowToApi(updated) as Appointment
    const [enriched] = await withServiceDescriptionsFromDb([data])

    if (body.status === "canceled") {
      await notifyFirstWaitingList(barbershopId, enriched)
    }
    if (body.status === "completed" && beforeApi.status !== "completed") {
      void trySendWhatsAppAppointmentPostService(barbershopId, id)
    }
    return NextResponse.json(enriched as Appointment)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

async function notifyFirstWaitingList(barbershopId: string, appointment: Appointment) {
  const first = await prisma.waitingListItem.findFirst({
    where: { barbershopId, status: "waiting" },
    orderBy: { createdAt: "asc" },
    select: { id: true, clientId: true, serviceId: true },
  })
  if (!first) return
  await prisma.waitingListItem.update({
    where: { id: first.id },
    data: { status: "notified", notifiedAt: new Date() },
  })
  await prisma.notificationLog.create({
    data: {
      barbershopId,
      clientId: first.clientId,
      appointmentId: appointment.id,
      type: "push",
      event: "waiting_list_slot_available",
      payload: {
        date: appointment.date,
        time: appointment.time,
        service_id: appointment.service_id,
      },
    },
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    const selectedUnitId = await resolveSelectedUnitId(barbershopId)
    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        barbershopId,
        ...(selectedUnitId ? { unitId: selectedUnitId } : {}),
      },
      include: appointmentApiInclude,
    })
    if (appointment) {
      await notifyFirstWaitingList(barbershopId, mapAppointmentRowToApi(appointment))
    }
    const del = await prisma.appointment.deleteMany({
      where: {
        id,
        barbershopId,
        ...(selectedUnitId ? { unitId: selectedUnitId } : {}),
      },
    })
    if (del.count === 0) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao excluir" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
