/**
 * Converte data do agendamento (Date @db.Date) + hora "HH:MM" em instante UTC,
 * assumindo fuso fixo UTC−3 (horário de Brasília, sem DST).
 */
export function appointmentStartUtcMs(date: Date, timeStr: string): number {
  const y = date.getUTCFullYear()
  const mo = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  const part = timeStr.slice(0, 5)
  const [hh, mm] = part.split(":").map((x) => Number(x))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN
  return Date.UTC(y, mo - 1, d, hh + 3, mm, 0)
}
