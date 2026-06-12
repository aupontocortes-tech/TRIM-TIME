/**
 * Cálculo e agregação de comissões de barbeiros (Trim Time).
 */
import type { AppointmentStatus } from "@prisma/client"
import { parseAppointmentDate } from "@/lib/appointment-prisma-helpers"
import { prisma } from "@/lib/prisma"
import { prismaAppointmentUnitFilter, prismaBarberUnitFilter } from "@/lib/unit-context"

/** Status de agendamento que entram no faturamento/comissão (alinhado ao dashboard). */
export const COMMISSION_APPOINTMENT_STATUSES = ["completed", "confirmed"] as const

export function saleCommissionAmount(totalPrice: number, percent: number): number {
  const price = Number(totalPrice)
  if (!Number.isFinite(price) || price < 0) return 0
  const p = Number(percent)
  const clamped = Math.min(100, Math.max(0, Number.isFinite(p) ? p : 0))
  return Math.round((price * clamped) / 100 * 100) / 100
}

export type CommissionBarberRow = {
  barber_id: string
  barber_name: string
  amount: number
  commission_percent: number
}

export type CommissionsSummaryResponse = {
  enabled: boolean
  from: string
  to: string
  total: number
  byBarber: CommissionBarberRow[]
}

/**
 * Soma comissões no período [startDate, endDate] (YYYY-MM-DD) por barbeiro.
 * Usa Prisma + filtro de unidade alinhado ao financeiro (`prismaAppointmentUnitFilter`).
 */
export async function aggregateCommissionsForRange(
  barbershopId: string,
  startDate: string,
  endDate: string,
  unitId?: string | null
): Promise<{ total: number; byBarber: CommissionBarberRow[] }> {
  const unitFilter = unitId ? prismaAppointmentUnitFilter(unitId) : {}
  const barberUnitFilter = unitId ? prismaBarberUnitFilter(unitId) : {}

  const [appointments, barbers] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        barbershopId,
        ...unitFilter,
        date: {
          gte: parseAppointmentDate(startDate),
          lte: parseAppointmentDate(endDate),
        },
        status: { in: [...COMMISSION_APPOINTMENT_STATUSES] as AppointmentStatus[] },
      },
      select: {
        barberId: true,
        totalPrice: true,
        commissionAmount: true,
        commissionPercent: true,
      },
    }),
    prisma.barber.findMany({
      where: { barbershopId, ...barberUnitFilter },
      select: { id: true, name: true, commission: true },
    }),
  ])

  const pctById = new Map<string, number>()
  const nameById = new Map<string, string>()
  for (const b of barbers) {
    pctById.set(b.id, Number(b.commission) || 0)
    nameById.set(b.id, b.name ?? "Barbeiro")
  }

  const amountByBarber = new Map<string, number>()
  for (const a of appointments) {
    const stored =
      a.commissionAmount != null ? Number(a.commissionAmount) : null
    let amt: number
    if (stored != null && Number.isFinite(stored)) {
      amt = stored
    } else {
      const price = Number(a.totalPrice) || 0
      const pct =
        a.commissionPercent != null
          ? Number(a.commissionPercent)
          : (pctById.get(a.barberId) ?? 0)
      amt = saleCommissionAmount(price, pct)
    }
    amountByBarber.set(a.barberId, (amountByBarber.get(a.barberId) ?? 0) + amt)
  }

  let total = 0
  const byBarber: CommissionBarberRow[] = []
  for (const [barberId, raw] of amountByBarber) {
    const rounded = Math.round(raw * 100) / 100
    if (rounded <= 0) continue
    total += rounded
    byBarber.push({
      barber_id: barberId,
      barber_name: nameById.get(barberId) ?? "Barbeiro",
      amount: rounded,
      commission_percent: pctById.get(barberId) ?? 0,
    })
  }
  byBarber.sort((a, b) => b.amount - a.amount)
  total = Math.round(total * 100) / 100

  return { total, byBarber }
}
