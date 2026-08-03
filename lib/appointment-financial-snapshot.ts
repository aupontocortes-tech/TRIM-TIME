import { prisma } from "@/lib/prisma"
import { appointmentStartsAtUtcFromYmd } from "@/lib/appointment-reminder-time"
import type { Appointment } from "@/lib/db/types"

const SALE_CATEGORY = "appointment_sale"

/** Garante lançamento financeiro quando o agendamento é finalizado (preserva faturamento após limpeza do histórico). */
export async function ensureAppointmentSaleLedgerEntry(
  barbershopId: string,
  appointment: Appointment
): Promise<void> {
  if (appointment.status !== "completed") return

  const existing = await prisma.financialLedgerEntry.findFirst({
    where: {
      barbershopId,
      appointmentId: appointment.id,
      direction: "entrada",
      category: SALE_CATEGORY,
    },
    select: { id: true },
  })
  if (existing) return

  const amount = Number(appointment.total_price ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) return

  const ymd = String(appointment.date).slice(0, 10)
  const time = String(appointment.time ?? "12:00").slice(0, 5)
  const occurredAt = appointmentStartsAtUtcFromYmd(ymd, time)

  const clientName = appointment.client?.name?.trim() || "Cliente"
  const serviceName = appointment.service?.name?.trim() || "Serviço"

  await prisma.financialLedgerEntry.create({
    data: {
      barbershopId,
      unitId: appointment.unit_id ?? null,
      direction: "entrada",
      category: SALE_CATEGORY,
      amount,
      appointmentId: appointment.id,
      note: `Agendamento: ${clientName} — ${serviceName}`,
      occurredAt,
    },
  })
}

/** Soma de vendas arquivadas (agendamento apagado do histórico, valor mantido no financeiro). */
export async function sumArchivedAppointmentSales(args: {
  barbershopId: string
  from: Date
  to: Date
  unitId?: string | null
}): Promise<number> {
  const rows = await prisma.financialLedgerEntry.findMany({
    where: {
      barbershopId: args.barbershopId,
      direction: "entrada",
      category: SALE_CATEGORY,
      appointmentId: null,
      occurredAt: { gte: args.from, lte: args.to },
      ...(args.unitId ? { unitId: args.unitId } : {}),
    },
    select: { amount: true },
  })
  return rows.reduce((s, r) => s + Number(r.amount), 0)
}

export { SALE_CATEGORY }
