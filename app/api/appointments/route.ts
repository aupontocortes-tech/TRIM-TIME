import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasBarberSlotConflict, normalizeAppointmentTime } from "@/lib/scheduling"
import { resolveSelectedUnitId } from "@/lib/unit-context"
import type { Appointment } from "@/lib/db/types"
import { prisma } from "@/lib/prisma"
import {
  appointmentApiInclude,
  mapAppointmentRowToApi,
  parseAppointmentDate,
} from "@/lib/appointment-prisma-helpers"
import { withServiceDescriptionsFromDb } from "@/lib/service-queries"
import { trySendWhatsAppAppointmentConfirmation } from "@/lib/whatsapp-appointment-events"

export async function GET(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date") // YYYY-MM-DD
    const barberId = searchParams.get("barber_id")
    const selectedUnitId = await resolveSelectedUnitId(barbershopId)
    const rows = await prisma.appointment.findMany({
      where: {
        barbershopId,
        ...(selectedUnitId ? { unitId: selectedUnitId } : {}),
        ...(date ? { date: parseAppointmentDate(date) } : {}),
        ...(barberId ? { barberId } : {}),
      },
      include: appointmentApiInclude,
      orderBy: { time: "asc" },
    })
    const list = rows.map(mapAppointmentRowToApi) as Appointment[]
    return NextResponse.json(await withServiceDescriptionsFromDb(list))
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
    const body = await request.json() as {
      client_id: string
      barber_id: string
      service_id: string
      unit_id?: string | null
      date: string
      time: string
      total_price?: number
    }
    if (!body.client_id || !body.barber_id || !body.service_id || !body.date || !body.time) {
      return NextResponse.json(
        { error: "client_id, barber_id, service_id, date e time são obrigatórios" },
        { status: 400 }
      )
    }
    const selectedUnitId = await resolveSelectedUnitId(barbershopId)
    const effectiveUnitId = body.unit_id ?? selectedUnitId
    if (effectiveUnitId) {
      const unit = await prisma.barbershopUnit.findFirst({
        where: { id: effectiveUnitId, barbershopId },
        select: { id: true },
      })
      if (!unit) {
        return NextResponse.json({ error: "Unidade inválida para esta barbearia" }, { status: 400 })
      }
    }
    const apptDate = parseAppointmentDate(body.date)
    const existing = await prisma.appointment.findFirst({
      where: {
        barbershopId,
        clientId: body.client_id,
        date: apptDate,
        status: { not: "canceled" },
      },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Você já possui um agendamento neste dia. Cancele-o para poder fazer outro." },
        { status: 400 }
      )
    }
    const conflict = await hasBarberSlotConflict({
      barbershopId,
      barberId: body.barber_id,
      date: body.date,
      time: body.time,
    })
    if (conflict) {
      return NextResponse.json(
        { error: "Este horário já está ocupado para o barbeiro escolhido." },
        { status: 409 }
      )
    }
    const service = await prisma.service.findFirst({
      where: { id: body.service_id, barbershopId },
      select: { price: true },
    })
    const totalPrice = body.total_price ?? (service != null ? Number(service.price) : 0)
    const created = await prisma.appointment.create({
      data: {
        barbershopId,
        clientId: body.client_id,
        barberId: body.barber_id,
        serviceId: body.service_id,
        unitId: effectiveUnitId ?? null,
        date: apptDate,
        time: normalizeAppointmentTime(body.time),
        status: "pending",
        totalPrice,
      },
      include: appointmentApiInclude,
    })
    void trySendWhatsAppAppointmentConfirmation(barbershopId, created.id)
    return NextResponse.json(mapAppointmentRowToApi(created) as Appointment)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar agendamento" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
