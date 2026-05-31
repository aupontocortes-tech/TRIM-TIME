/**
 * Expiração da lista de espera com base no dia desejado e horário de fechamento da barbearia.
 */
import type { BarbershopSettings } from "@/lib/db/types"
import {
  appointmentStartsAtUtcFromYmd,
  normalizeSlotTime,
} from "@/lib/appointment-reminder-time"
import { DIAS_SEMANA_KEYS, openingHoursFromSettings } from "@/lib/barbershop-settings-ui"

const JS_DAY_TO_KEY: Record<number, (typeof DIAS_SEMANA_KEYS)[number]> = {
  0: "domingo",
  1: "segunda",
  2: "terca",
  3: "quarta",
  4: "quinta",
  5: "sexta",
  6: "sabado",
}

function tzOffsetHours(): number {
  const raw =
    typeof process !== "undefined"
      ? process.env.APPOINTMENT_TZ_OFFSET_HOURS ?? process.env.NEXT_PUBLIC_APPOINTMENT_TZ_OFFSET_HOURS
      : undefined
  if (raw != null && raw !== "") {
    const n = Number(raw)
    if (!Number.isNaN(n)) return n
  }
  return 3
}

/** YYYY-MM-DD a partir de Date @db.Date (UTC). */
export function ymdFromDbDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Hoje (YYYY-MM-DD) no fuso da barbearia. */
export function shopTodayYmd(now: Date = new Date()): string {
  const off = tzOffsetHours()
  const shifted = new Date(now.getTime() + off * 60 * 60 * 1000)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0")
  const d = String(shifted.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function dateFromYmd(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`)
}

function dayKeyForYmd(ymd: string): (typeof DIAS_SEMANA_KEYS)[number] {
  const [y, mo, d] = ymd.split("-").map(Number)
  const jsDay = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay()
  return JS_DAY_TO_KEY[jsDay] ?? "segunda"
}

/** Instant UTC em que a fila daquele dia deixa de valer (horário de fechamento ou início se loja fechada). */
export function desiredDateWaitlistExpiresAtMs(
  desiredDate: Date,
  settings: BarbershopSettings | null | undefined
): number {
  const ymd = ymdFromDbDate(desiredDate)
  const hours = openingHoursFromSettings(settings?.opening_hours)
  const day = hours[dayKeyForYmd(ymd)]

  if (!day?.ativo) {
    return appointmentStartsAtUtcFromYmd(ymd, "00:00").getTime()
  }

  const close = normalizeSlotTime(day.fechamento || "22:00")
  return appointmentStartsAtUtcFromYmd(ymd, close).getTime()
}

export function isDesiredDateWaitlistExpired(
  desiredDate: Date,
  settings: BarbershopSettings | null | undefined,
  now: Date = new Date()
): boolean {
  return now.getTime() >= desiredDateWaitlistExpiresAtMs(desiredDate, settings)
}

/** Rótulo amigável para agrupamento no painel. */
export function formatWaitlistDayLabel(desiredYmd: string, todayYmd: string): string {
  if (desiredYmd === todayYmd) return "Hoje"
  const today = dateFromYmd(todayYmd)
  const target = dateFromYmd(desiredYmd)
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 1) return "Amanhã"
  const [, m, d] = desiredYmd.split("-")
  return `${d}/${m}`
}
