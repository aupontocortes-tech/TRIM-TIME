/**
 * Cálculo e agregação de comissões de barbeiros (Trim Time).
 */
import type { SupabaseClient } from "@supabase/supabase-js"

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
 */
export async function aggregateCommissionsForRange(
  supabase: SupabaseClient,
  barbershopId: string,
  startDate: string,
  endDate: string,
  unitId?: string | null
): Promise<{ total: number; byBarber: CommissionBarberRow[] }> {
  let appointmentsQuery = supabase
    .from("appointments")
    .select("barber_id, total_price")
    .eq("barbershop_id", barbershopId)
    .gte("date", startDate)
    .lte("date", endDate)
    .in("status", [...COMMISSION_APPOINTMENT_STATUSES])
  if (unitId) appointmentsQuery = appointmentsQuery.or(`unit_id.eq.${unitId},unit_id.is.null`)

  const [{ data: appointments }, { data: barbers }] = await Promise.all([
    appointmentsQuery,
    supabase.from("barbers").select("id, name, commission").eq("barbershop_id", barbershopId),
  ])

  const pctById = new Map<string, number>()
  const nameById = new Map<string, string>()
  for (const b of barbers ?? []) {
    pctById.set(b.id, Number(b.commission) || 0)
    nameById.set(b.id, b.name ?? "Barbeiro")
  }

  const amountByBarber = new Map<string, number>()
  for (const a of appointments ?? []) {
    const price = Number(a.total_price) || 0
    const pct = pctById.get(a.barber_id) ?? 0
    const amt = saleCommissionAmount(price, pct)
    amountByBarber.set(a.barber_id, (amountByBarber.get(a.barber_id) ?? 0) + amt)
  }

  const barberIds = new Set<string>()
  for (const b of barbers ?? []) barberIds.add(b.id)
  for (const id of amountByBarber.keys()) barberIds.add(id)

  let total = 0
  const byBarber: CommissionBarberRow[] = []
  for (const barberId of barberIds) {
    const raw = amountByBarber.get(barberId) ?? 0
    const rounded = Math.round(raw * 100) / 100
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
