import { prisma } from "@/lib/prisma"
import { isSlotPastGrace } from "@/lib/appointment-reminder-time"
import { normalizeAppointmentTime } from "@/lib/scheduling"

/**
 * Cliente só fica “preso” no dia enquanto existir agendamento pending/confirmed
 * cujo início + tolerância ainda não passou. Concluídos, no_show, cancelados ou
 * horários já vencidos (mesmo se o job ainda não marcou no_show) liberam novo agendamento.
 */
export async function clientHasBlockingAppointmentOnDay(args: {
  barbershopId: string
  clientId: string
  dayBounds: { gte: Date; lt: Date }
  ignoreAppointmentIds?: string[]
}): Promise<boolean> {
  const rows = await prisma.appointment.findMany({
    where: {
      barbershopId: args.barbershopId,
      clientId: args.clientId,
      date: { gte: args.dayBounds.gte, lt: args.dayBounds.lt },
      status: { in: ["pending", "confirmed"] },
      ...(args.ignoreAppointmentIds?.length ? { id: { notIn: args.ignoreAppointmentIds } } : {}),
    },
    select: { date: true, time: true },
  })
  const now = new Date()
  return rows.some((row) => {
    const t = normalizeAppointmentTime(String(row.time ?? ""))
    return !isSlotPastGrace(row.date, t, now)
  })
}
