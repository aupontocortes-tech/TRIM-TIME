import { prisma } from "@/lib/prisma"
import { isAppointmentEnded } from "@/lib/appointment-reminder-time"
import { normalizeAppointmentTime } from "@/lib/scheduling"

/**
 * Cliente só fica “preso” no dia enquanto existir agendamento pending/confirmed
 * cujo horário ainda não terminou. Finalizados, pendente de finalização, no_show,
 * cancelados ou horários já encerrados liberam novo agendamento.
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
    select: { date: true, time: true, service: { select: { duration: true } } },
  })
  const now = new Date()
  return rows.some((row) => {
    const t = normalizeAppointmentTime(String(row.time ?? ""))
    const dur = row.service?.duration ?? 30
    return !isAppointmentEnded(row.date, t, dur, now)
  })
}
