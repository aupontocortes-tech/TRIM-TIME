import type {
  BarbershopInactiveClientMarketing,
  BarbershopSettings,
  NormalizedInactiveClientMarketing,
  SubscriptionPlan,
} from "@/lib/db/types"
import { hasFeature } from "@/lib/plans"
import {
  DEFAULT_WHATSAPP_INACTIVE_FIRST,
  DEFAULT_WHATSAPP_INACTIVE_SECOND,
} from "@/lib/notification-default-templates"
import type { NotificationTemplateVars } from "@/lib/notification-template"

export const INACTIVE_MARKETING_DEFAULT_FIRST_DAYS = 30
export const INACTIVE_MARKETING_DEFAULT_SECOND_DAYS = 60
export const INACTIVE_MARKETING_DEFAULT_STOP_DAYS = 90

const MIN_DAYS = 7
const MAX_DAYS = 365

export function inactiveClientMarketingEnabled(plan: SubscriptionPlan | null): boolean {
  return !!(plan && hasFeature(plan, "marketing_inactive"))
}

function clampDays(value: unknown, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, n))
}

export function normalizeInactiveClientMarketing(
  raw: BarbershopInactiveClientMarketing | null | undefined
): NormalizedInactiveClientMarketing {
  const first = clampDays(raw?.first_message_days, INACTIVE_MARKETING_DEFAULT_FIRST_DAYS)
  let second = clampDays(raw?.second_message_days, INACTIVE_MARKETING_DEFAULT_SECOND_DAYS)
  let stop = clampDays(raw?.stop_after_days, INACTIVE_MARKETING_DEFAULT_STOP_DAYS)
  if (second <= first) second = first + MIN_DAYS
  if (stop <= second) stop = second + MIN_DAYS
  return {
    enabled: raw?.enabled === true,
    first_message_days: first,
    second_message_days: second,
    stop_after_days: stop,
    whatsapp_first_template: raw?.whatsapp_first_template?.trim() || DEFAULT_WHATSAPP_INACTIVE_FIRST,
    whatsapp_second_template: raw?.whatsapp_second_template?.trim() || DEFAULT_WHATSAPP_INACTIVE_SECOND,
  }
}

export function parseInactiveClientMarketing(
  settings: BarbershopSettings | null | undefined,
  plan: SubscriptionPlan | null
): NormalizedInactiveClientMarketing | null {
  if (!inactiveClientMarketingEnabled(plan)) return null
  const cfg = normalizeInactiveClientMarketing(settings?.inactive_client_marketing)
  if (!cfg.enabled) return null
  return cfg
}

export function validateInactiveClientMarketingInput(
  input: BarbershopInactiveClientMarketing | null | undefined,
  plan: SubscriptionPlan | null
): { ok: true; config: NormalizedInactiveClientMarketing } | { ok: false; error: string } {
  if (!input || !input.enabled) {
    return {
      ok: true,
      config: normalizeInactiveClientMarketing({ enabled: false }),
    }
  }
  if (!inactiveClientMarketingEnabled(plan)) {
    return { ok: false, error: "Marketing para clientes inativos disponível no plano Premium." }
  }
  const cfg = normalizeInactiveClientMarketing(input)
  if (cfg.second_message_days <= cfg.first_message_days) {
    return { ok: false, error: "A 2ª mensagem deve ser enviada após mais dias que a 1ª." }
  }
  if (cfg.stop_after_days <= cfg.second_message_days) {
    return { ok: false, error: "O prazo para desistir deve ser maior que o da 2ª mensagem." }
  }
  if (!cfg.whatsapp_first_template.trim() || !cfg.whatsapp_second_template.trim()) {
    return { ok: false, error: "Preencha os textos das mensagens de reativação." }
  }
  return { ok: true, config: cfg }
}

export function buildInactiveClientMarketingVars(input: {
  clientName: string
  barbershopName: string
  slug: string
  daysSinceVisit: number
  baseUrl?: string
}): NotificationTemplateVars {
  const base = input.baseUrl?.replace(/\/$/, "") || ""
  const link = base ? `${base}/b/${input.slug}` : `/b/${input.slug}`
  return {
    nome_cliente: input.clientName.trim() || "Cliente",
    data: "",
    horario: "",
    servico: "",
    barbearia: input.barbershopName.trim() || "Barbearia",
    unidade: input.barbershopName.trim() || "Barbearia",
    endereco: "",
    maps: "",
    barbeiro: "",
    link_agendamento: link,
    dias_sem_visita: String(Math.max(1, Math.round(input.daysSinceVisit))),
  }
}

export function formatDateKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function daysBetweenUtc(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  return Math.floor((b - a) / (24 * 60 * 60 * 1000))
}
