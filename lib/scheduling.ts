/**
 * Regras de agenda: conflito de horário por barbeiro (evita double booking).
 * Dados via Prisma (tabelas reais do Postgres / Supabase).
 */
import { AppointmentStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { utcDayRangeForYmd } from "@/lib/appointment-prisma-helpers"

/** Status que ocupam o slot (não cancelado / não concluído como “livre” para o mesmo horário). */
export const SLOT_BLOCKING_STATUSES = ["pending", "confirmed"] as const satisfies readonly AppointmentStatus[]

/** Normaliza "09:30", "09:30:00" → "09:30" para comparar com o que o DB devolve. */
export function normalizeAppointmentTime(time: string): string {
  const t = time.trim()
  if (t.length >= 5) return t.slice(0, 5)
  return t
}

export async function hasBarberSlotConflict(args: {
  barbershopId: string
  barberId: string
  date: string
  time: string
  excludeAppointmentId?: string
}): Promise<boolean> {
  const want = normalizeAppointmentTime(args.time)
  const { gte, lt } = utcDayRangeForYmd(args.date)
  const rows = await prisma.appointment.findMany({
    where: {
      barbershopId: args.barbershopId,
      barberId: args.barberId,
      date: { gte, lt },
      status: { in: [...SLOT_BLOCKING_STATUSES] },
      ...(args.excludeAppointmentId ? { id: { not: args.excludeAppointmentId } } : {}),
    },
    select: { time: true },
  })
  return rows.some((row) => normalizeAppointmentTime(String(row.time ?? "")) === want)
}
