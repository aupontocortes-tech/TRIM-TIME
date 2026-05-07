/** Data civil no fuso local do navegador/servidor (YYYY-MM-DD). Evita erro de usar UTC via toISOString(). */
export function toYMDLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function startOfMonthYMDLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}-01`
}

export function isYMDDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}
