import type {
  BarbershopBookingRules,
  BarbershopOpeningDay,
  BarbershopSettings,
} from "@/lib/db/types"

/** Estado dos horários na UI (português). */
export type HorarioDiaUi = { ativo: boolean; abertura: string; fechamento: string }
export type BlockedRangeUi = { start: string; end: string }
export type BookingRulesUi = {
  minLeadMinutes: number
  blockedRanges: Record<(typeof DIAS_SEMANA_KEYS)[number], BlockedRangeUi[]>
}

export const DIAS_SEMANA_KEYS = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
] as const

export function defaultHorariosUi(): Record<(typeof DIAS_SEMANA_KEYS)[number], HorarioDiaUi> {
  const day = (ativo: boolean, ab: string, fc: string): HorarioDiaUi => ({
    ativo,
    abertura: ab,
    fechamento: fc,
  })
  return {
    segunda: day(true, "09:00", "20:00"),
    terca: day(true, "09:00", "20:00"),
    quarta: day(true, "09:00", "20:00"),
    quinta: day(true, "09:00", "20:00"),
    sexta: day(true, "09:00", "20:00"),
    sabado: day(true, "09:00", "18:00"),
    domingo: day(false, "09:00", "18:00"),
  }
}

export function openingHoursFromSettings(
  oh: BarbershopSettings["opening_hours"] | undefined
): Record<(typeof DIAS_SEMANA_KEYS)[number], HorarioDiaUi> {
  const base = defaultHorariosUi()
  if (!oh) return base
  for (const key of DIAS_SEMANA_KEYS) {
    const h = oh[key]
    if (h) {
      base[key] = {
        ativo: h.active,
        abertura: (h.open || "09:00").slice(0, 5),
        fechamento: (h.close || "18:00").slice(0, 5),
      }
    }
  }
  return base
}

export function openingHoursToSettings(
  h: Record<string, HorarioDiaUi>
): Record<string, BarbershopOpeningDay> {
  const out: Record<string, BarbershopOpeningDay> = {}
  for (const key of DIAS_SEMANA_KEYS) {
    const v = h[key]
    if (v) {
      out[key] = { active: v.ativo, open: v.abertura, close: v.fechamento }
    }
  }
  return out
}

export function defaultBookingRulesUi(): BookingRulesUi {
  return {
    minLeadMinutes: 30,
    blockedRanges: {
      segunda: [],
      terca: [],
      quarta: [],
      quinta: [],
      sexta: [],
      sabado: [],
      domingo: [],
    },
  }
}

function normalizeTimeValue(raw: string): string {
  const t = String(raw ?? "").trim()
  return t.length >= 5 ? t.slice(0, 5) : ""
}

export function bookingRulesFromSettings(
  rules: BarbershopSettings["booking_rules"] | undefined
): BookingRulesUi {
  const base = defaultBookingRulesUi()
  if (!rules) return base
  const maybeLead = Number(rules.min_lead_minutes)
  if (Number.isFinite(maybeLead) && maybeLead >= 0) {
    base.minLeadMinutes = Math.round(maybeLead)
  }
  for (const key of DIAS_SEMANA_KEYS) {
    const items = Array.isArray(rules.blocked_ranges?.[key]) ? rules.blocked_ranges?.[key] : []
    base.blockedRanges[key] = items
      .map((it) => ({
        start: normalizeTimeValue(it?.start ?? ""),
        end: normalizeTimeValue(it?.end ?? ""),
      }))
      .filter((it) => it.start && it.end && it.end > it.start)
  }
  return base
}

export function bookingRulesToSettings(ui: BookingRulesUi): BarbershopBookingRules {
  const blocked: Record<string, { start: string; end: string }[]> = {}
  for (const key of DIAS_SEMANA_KEYS) {
    const rows = (ui.blockedRanges[key] ?? [])
      .map((it) => ({ start: normalizeTimeValue(it.start), end: normalizeTimeValue(it.end) }))
      .filter((it) => it.start && it.end && it.end > it.start)
    blocked[key] = rows
  }
  return {
    min_lead_minutes: Math.max(0, Math.round(Number(ui.minLeadMinutes) || 0)),
    blocked_ranges: blocked,
  }
}
