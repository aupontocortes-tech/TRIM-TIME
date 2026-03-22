/**
 * Regras de agenda: conflito de horário por barbeiro (evita double booking).
 * Usa as mesmas tabelas/colunas que as API routes (Supabase).
 */
import type { SupabaseClient } from "@supabase/supabase-js"

/** Status que ocupam o slot (não cancelado / não concluído como “livre” para o mesmo horário). */
export const SLOT_BLOCKING_STATUSES = ["pending", "confirmed"] as const

/** Normaliza "09:30", "09:30:00" → "09:30" para comparar com o que o DB devolve. */
export function normalizeAppointmentTime(time: string): string {
  const t = time.trim()
  if (t.length >= 5) return t.slice(0, 5)
  return t
}

export async function hasBarberSlotConflict(
  supabase: SupabaseClient,
  args: {
    barbershopId: string
    barberId: string
    date: string
    time: string
    excludeAppointmentId?: string
  }
): Promise<boolean> {
  const want = normalizeAppointmentTime(args.time)
  let q = supabase
    .from("appointments")
    .select("id, time")
    .eq("barbershop_id", args.barbershopId)
    .eq("barber_id", args.barberId)
    .eq("date", args.date)
    .in("status", [...SLOT_BLOCKING_STATUSES])
  if (args.excludeAppointmentId) {
    q = q.neq("id", args.excludeAppointmentId)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).some((row: { time?: string }) => normalizeAppointmentTime(String(row.time ?? "")) === want)
}
