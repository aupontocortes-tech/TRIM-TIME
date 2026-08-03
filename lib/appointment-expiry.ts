/**
 * Quando o horário do serviço termina, pending/confirmed → pending_finalization.
 * Nunca apaga agendamentos automaticamente (exceto cancelados antigos via rotina configurável).
 */
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isAppointmentEnded } from "@/lib/appointment-reminder-time"
import { canceledRetentionDays } from "@/lib/appointment-status"
import type { BarbershopSettings } from "@/lib/db/types"
import { normalizeAppointmentTime, SLOT_BLOCKING_STATUSES } from "@/lib/scheduling"

type AppointmentEndCandidate = {
  id: string
  date: Date
  time: string
  service: { duration: number | null } | null
  appointmentServiceLines: { quantity: number; service: { duration: number | null } }[]
}

function durationMinutes(row: AppointmentEndCandidate): number {
  const lines = row.appointmentServiceLines ?? []
  if (lines.length > 0) {
    return lines.reduce(
      (acc, l) => acc + (l.service?.duration ?? 30) * Math.max(1, l.quantity),
      0
    )
  }
  return row.service?.duration ?? 30
}

/** pending/confirmed cujo serviço já terminou → pending_finalization. */
export async function transitionEndedAppointmentsWhere(where: Prisma.AppointmentWhereInput): Promise<number> {
  const candidates = (await prisma.appointment.findMany({
    where: {
      ...where,
      status: { in: [...SLOT_BLOCKING_STATUSES] },
    },
    select: {
      id: true,
      date: true,
      time: true,
      service: { select: { duration: true } },
      appointmentServiceLines: {
        select: { quantity: true, service: { select: { duration: true } } },
      },
    },
  })) as AppointmentEndCandidate[]

  const now = new Date()
  const ids = candidates
    .filter((a) =>
      isAppointmentEnded(a.date, normalizeAppointmentTime(a.time), durationMinutes(a), now)
    )
    .map((a) => a.id)

  if (ids.length === 0) return 0

  const result = await prisma.appointment.updateMany({
    where: { id: { in: ids } },
    data: { status: "pending_finalization" },
  })
  return result.count
}

export async function transitionEndedAppointmentsForBarbershop(barbershopId: string): Promise<number> {
  return transitionEndedAppointmentsWhere({ barbershopId })
}

/** @deprecated Use transitionEndedAppointmentsForBarbershop */
export async function expireStaleAppointmentsForBarbershop(barbershopId: string): Promise<number> {
  return transitionEndedAppointmentsForBarbershop(barbershopId)
}

/** @deprecated Use transitionEndedAppointmentsWhere */
export async function expireStaleAppointmentsWhere(where: Prisma.AppointmentWhereInput): Promise<number> {
  return transitionEndedAppointmentsWhere(where)
}

/** Remove cancelados antigos do histórico (configurável; padrão 90 dias). */
export async function cleanupOldCanceledAppointmentsForBarbershop(
  barbershopId: string,
  settings?: BarbershopSettings | null
): Promise<number> {
  const days = canceledRetentionDays(settings)
  if (days <= 0) return 0

  const cutoff = new Date()
  cutoff.setUTCHours(0, 0, 0, 0)
  cutoff.setUTCDate(cutoff.getUTCDate() - days)

  const result = await prisma.appointment.deleteMany({
    where: {
      barbershopId,
      status: "canceled",
      date: { lt: cutoff },
    },
  })
  return result.count
}
