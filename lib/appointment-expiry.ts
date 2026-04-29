/**
 * Agendamentos pending/confirmed com horário de início + 1h já ultrapassados passam a no_show
 * (estado de “expirado” no produto — o enum do banco não possui valor dedicado).
 */
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isSlotPastGrace } from "@/lib/appointment-reminder-time"
import { SLOT_BLOCKING_STATUSES, normalizeAppointmentTime } from "@/lib/scheduling"

export async function expireStaleAppointmentsWhere(where: Prisma.AppointmentWhereInput): Promise<number> {
  const candidates = await prisma.appointment.findMany({
    where: {
      ...where,
      status: { in: [...SLOT_BLOCKING_STATUSES] },
    },
    select: { id: true, date: true, time: true },
  })
  const now = new Date()
  const ids = candidates.filter((a) => isSlotPastGrace(a.date, normalizeAppointmentTime(a.time), now)).map((a) => a.id)
  if (ids.length === 0) return 0
  const result = await prisma.appointment.updateMany({
    where: { id: { in: ids } },
    data: { status: "no_show" },
  })
  return result.count
}

export async function expireStaleAppointmentsForBarbershop(barbershopId: string): Promise<number> {
  return expireStaleAppointmentsWhere({ barbershopId })
}
