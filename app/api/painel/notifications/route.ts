import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import {
  resolveSelectedUnitId,
  prismaAppointmentUnitFilter,
  prismaWaitlistUnitFilter,
} from "@/lib/unit-context"

/**
 * Central de notificações do painel (dono da barbearia).
 * Retorna eventos recentes: novos agendamentos, cancelamentos e novas entradas na lista de espera.
 * Somente leitura; respeita a unidade selecionada no painel.
 */

const WINDOW_DAYS = 7
const MAX_EVENTS = 30

type PainelNotification = {
  id: string
  kind: "new_appointment" | "canceled" | "waitlist"
  clientName: string
  serviceName: string | null
  barberName: string | null
  /** Data/hora do evento (quando entrou na lista). ISO. */
  when: string
  /** Data/hora do agendamento em si (quando aplicável). */
  apptDate: string | null
  apptTime: string | null
}

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    const selectedUnitId = await resolveSelectedUnitId(barbershopId)
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

    const apptUnitFilter = prismaAppointmentUnitFilter(selectedUnitId)
    const waitlistUnitFilter = prismaWaitlistUnitFilter(selectedUnitId)

    const [newAppointments, canceledAppointments, waitlistItems] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          barbershopId,
          status: { not: "canceled" },
          createdAt: { gte: since },
          ...apptUnitFilter,
        },
        orderBy: { createdAt: "desc" },
        take: MAX_EVENTS,
        select: {
          id: true,
          createdAt: true,
          date: true,
          time: true,
          client: { select: { name: true } },
          service: { select: { name: true } },
          barber: { select: { name: true } },
        },
      }),
      prisma.appointment.findMany({
        where: {
          barbershopId,
          status: "canceled",
          updatedAt: { gte: since },
          ...apptUnitFilter,
        },
        orderBy: { updatedAt: "desc" },
        take: MAX_EVENTS,
        select: {
          id: true,
          updatedAt: true,
          date: true,
          time: true,
          client: { select: { name: true } },
          service: { select: { name: true } },
          barber: { select: { name: true } },
        },
      }),
      prisma.waitingListItem.findMany({
        where: {
          barbershopId,
          status: "waiting",
          createdAt: { gte: since },
          ...waitlistUnitFilter,
        },
        orderBy: { createdAt: "desc" },
        take: MAX_EVENTS,
        select: {
          id: true,
          createdAt: true,
          desiredDate: true,
          desiredTime: true,
          client: { select: { name: true } },
          service: { select: { name: true } },
          barber: { select: { name: true } },
        },
      }),
    ])

    const events: PainelNotification[] = [
      ...newAppointments.map((a) => ({
        id: `new_appointment:${a.id}`,
        kind: "new_appointment" as const,
        clientName: a.client?.name ?? "Cliente",
        serviceName: a.service?.name ?? null,
        barberName: a.barber?.name ?? null,
        when: a.createdAt.toISOString(),
        apptDate: a.date ? a.date.toISOString() : null,
        apptTime: a.time ?? null,
      })),
      ...canceledAppointments.map((a) => ({
        id: `canceled:${a.id}`,
        kind: "canceled" as const,
        clientName: a.client?.name ?? "Cliente",
        serviceName: a.service?.name ?? null,
        barberName: a.barber?.name ?? null,
        when: a.updatedAt.toISOString(),
        apptDate: a.date ? a.date.toISOString() : null,
        apptTime: a.time ?? null,
      })),
      ...waitlistItems.map((w) => ({
        id: `waitlist:${w.id}`,
        kind: "waitlist" as const,
        clientName: w.client?.name ?? "Cliente",
        serviceName: w.service?.name ?? null,
        barberName: w.barber?.name ?? null,
        when: w.createdAt.toISOString(),
        apptDate: w.desiredDate ? w.desiredDate.toISOString() : null,
        apptTime: w.desiredTime ?? null,
      })),
    ]
      .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
      .slice(0, MAX_EVENTS)

    return NextResponse.json({ events })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não autorizado" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
