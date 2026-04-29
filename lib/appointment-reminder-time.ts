/**
 * Converte data civil do agendamento (Date @db.Date) + hora "HH:MM" em instante UTC,
 * assumindo fuso da barbearia (padrão UTC−3, Brasília, sem DST desde 2019).
 */
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

export function normalizeSlotTime(timeStr: string): string {
  const t = String(timeStr ?? "").trim()
  return t.length >= 5 ? t.slice(0, 5) : t
}

export function appointmentStartsAtUtc(date: Date, timeStr: string): Date {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  const d = date.getUTCDate()
  const part = normalizeSlotTime(timeStr)
  const [hh, mm] = part.split(":").map((x) => Number(x))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return new Date(NaN)
  const off = tzOffsetHours()
  return new Date(Date.UTC(y, m, d, hh + off, mm, 0, 0))
}

/** Compat: lembretes usam ms desde epoch. */
export function appointmentStartUtcMs(date: Date, timeStr: string): number {
  return appointmentStartsAtUtc(date, timeStr).getTime()
}

export function appointmentStartsAtUtcFromYmd(ymd: string, timeStr: string): Date {
  const [y, mo, d] = ymd.split("-").map(Number)
  if (!y || !mo || !d) return new Date(NaN)
  const part = normalizeSlotTime(timeStr)
  const [hh, mm] = part.split(":").map((x) => Number(x))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return new Date(NaN)
  const off = tzOffsetHours()
  return new Date(Date.UTC(y, mo - 1, d, hh + off, mm, 0, 0))
}

const DEFAULT_GRACE_MS = 60 * 60 * 1000

export function isSlotPastGrace(
  date: Date,
  timeStr: string,
  now: Date = new Date(),
  graceMs: number = DEFAULT_GRACE_MS
): boolean {
  return appointmentStartsAtUtc(date, timeStr).getTime() + graceMs < now.getTime()
}

export function isSlotPastGraceFromYmd(
  ymd: string,
  timeStr: string,
  now: Date = new Date(),
  graceMs: number = DEFAULT_GRACE_MS
): boolean {
  return appointmentStartsAtUtcFromYmd(ymd, timeStr).getTime() + graceMs < now.getTime()
}
