import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasBarberSlotConflict, normalizeAppointmentTime } from "@/lib/scheduling"
import { resolveSelectedUnitId, validateBarberForUnit } from "@/lib/unit-context"
import type { Appointment } from "@/lib/db/types"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  mapAppointmentRowToApi,
  parseAppointmentDate,
  utcDayRangeForYmd,
} from "@/lib/appointment-prisma-helpers"
import {
  buildAppointmentListWhere,
  fetchAppointmentsWithRelations,
} from "@/lib/appointment-queries"
import { withServiceDescriptionsFromDb } from "@/lib/service-queries"
import { trySendWhatsAppAppointmentConfirmation } from "@/lib/whatsapp-appointment-events"
import { trySendEmailAppointmentConfirmation } from "@/lib/email-appointment-events"
import { trySendPushAppointmentConfirmation } from "@/lib/push-appointment-events"
import { expireStaleAppointmentsForBarbershop } from "@/lib/appointment-expiry"
import { clientHasBlockingAppointmentOnDay } from "@/lib/client-same-day-appointment"
import {
  syncAppointmentUnitsFromBarbers,
  withAppointmentDbSchema,
} from "@/lib/appointment-db-schema"

export async function GET(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    await withAppointmentDbSchema(async () => {
      await syncAppointmentUnitsFromBarbers(barbershopId)
      await expireStaleAppointmentsForBarbershop(barbershopId)
    })
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date") // YYYY-MM-DD
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const barberId = searchParams.get("barber_id")
    const networkScope = searchParams.get("network") === "1"
    const selectedUnitId = networkScope ? null : await resolveSelectedUnitId(barbershopId)

    const dateFilter: Prisma.DateTimeFilter | undefined = (() => {
      if (date) return { equals: parseAppointmentDate(date) }
      if (from || to) {
        const f: Prisma.DateTimeFilter = {}
        if (from) f.gte = parseAppointmentDate(from)
        if (to) f.lte = parseAppointmentDate(to)
        return Object.keys(f).length ? f : undefined
      }
      return undefined
    })()

    const where = await buildAppointmentListWhere(barbershopId, selectedUnitId, {
      ...(dateFilter ? { date: dateFilter } : {}),
      ...(barberId ? { barberId } : {}),
    })
    const rows = await fetchAppointmentsWithRelations(where)
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
    await withAppointmentDbSchema(() => expireStaleAppointmentsForBarbershop(barbershopId))
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

    const barberUnitCheck = await validateBarberForUnit({
      barbershopId,
      barberId: body.barber_id,
      unitId: effectiveUnitId,
    })
    if (!barberUnitCheck.ok) {
      return NextResponse.json({ error: barberUnitCheck.error }, { status: barberUnitCheck.status })
    }

    const apptDate = parseAppointmentDate(body.date)
    const dayRange = utcDayRangeForYmd(body.date)
    const existing = await clientHasBlockingAppointmentOnDay({
      barbershopId,
      clientId: body.client_id,
      dayBounds: dayRange,
    })
    if (existing) {
      return NextResponse.json(
        { error: "Você já possui um agendamento ativo neste dia. Cancele-o ou aguarde o horário passar para marcar outro." },
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
    const unitFromBarber =
      effectiveUnitId ??
      (
        await prisma.barber.findFirst({
          where: { id: body.barber_id, barbershopId },
          select: { unitId: true },
        })
      )?.unitId ??
      null

    const created = await withAppointmentDbSchema(() =>
      prisma.appointment.create({
        data: {
          barbershopId,
          clientId: body.client_id,
          barberId: body.barber_id,
          serviceId: body.service_id,
          unitId: unitFromBarber,
          date: apptDate,
          time: normalizeAppointmentTime(body.time),
          status: "pending",
          totalPrice,
          ...(service
            ? {
                appointmentServiceLines: {
                  create: [
                    {
                      serviceId: body.service_id,
                      quantity: 1,
                      unitPrice: Number(service.price),
                    },
                  ],
                },
              }
            : {}),
        },
        include: {
          client: true,
          barber: {
            select: {
              id: true,
              barbershopId: true,
              unitId: true,
              name: true,
              phone: true,
              email: true,
              cpf: true,
              photoUrl: true,
              commission: true,
              active: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          service: true,
          appointmentRetailLines: { include: { retailProduct: true } },
          appointmentServiceLines: { include: { service: true } },
        },
      })
    )
    void trySendWhatsAppAppointmentConfirmation(barbershopId, created.id)
    void trySendEmailAppointmentConfirmation(barbershopId, created.id)
    void trySendPushAppointmentConfirmation(barbershopId, created.id)
    return NextResponse.json(
      mapAppointmentRowToApi(created as Parameters<typeof mapAppointmentRowToApi>[0]) as Appointment
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar agendamento" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
