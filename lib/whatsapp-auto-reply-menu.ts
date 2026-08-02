import type { WhatsAppAutoReplyRule } from "@/lib/db/types"
import {
  DEFAULT_WHATSAPP_AUTO_REPLY_RULES,
} from "@/lib/whatsapp-auto-reply-defaults"

export type WhatsAppAutoReplyMenuItem = {
  n: number
  ruleId: string
  label: string
  hint: string
}

/** Título curto no menu (fácil de ler no WhatsApp). */
const MENU_LABELS: Record<string, string> = {
  endereco: "Endereço",
  horario: "Meu horário",
  confirmar: "Confirmar horário/vaga",
  lista_espera: "Lista de espera",
  cancelar_remarcar: "Cancelar ou remarcar",
  servicos: "Serviços e preços",
  funcionamento: "Horário de funcionamento",
  profissional_agendamento: "Quem vai me atender",
  profissionais: "Profissionais",
  unidades: "Unidades",
  agendar: "Agendar",
}

/** Palavra que o cliente pode digitar (além do número). */
const MENU_HINTS: Record<string, string> = {
  endereco: "onde fica",
  horario: "meu horario",
  confirmar: "confirmo",
  lista_espera: "minha fila",
  cancelar_remarcar: "remarcar",
  servicos: "quanto custa",
  funcionamento: "que horas abre",
  profissional_agendamento: "meu barbeiro",
  profissionais: "quais profissionais",
  unidades: "unidades",
  agendar: "agendar",
}

const MENU_TRIGGER_WORDS = [
  "menu",
  "opções",
  "opcoes",
  "opcao",
  "opção",
  "ajuda",
  "help",
  "comandos",
  "lista",
  "o que posso",
  "o que posso perguntar",
]

function normalizeMenuInput(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function menuLabel(rule: WhatsAppAutoReplyRule): string {
  if (rule.id && MENU_LABELS[rule.id]) return MENU_LABELS[rule.id]
  const kw = rule.keywords?.find((k) => k.trim())
  return kw?.trim() || rule.id || "Opção"
}

function menuHint(rule: WhatsAppAutoReplyRule): string {
  if (rule.id && MENU_HINTS[rule.id]) return MENU_HINTS[rule.id]
  const kw = rule.keywords?.find((k) => k.trim())
  return kw?.trim() || "palavra-chave"
}

/** Monta itens 1..N só com regras habilitadas (ordem padrão + extras no final). */
export function buildWhatsAppAutoReplyMenuItems(
  rules: WhatsAppAutoReplyRule[]
): WhatsAppAutoReplyMenuItem[] {
  const enabled = rules.filter((r) => r.id && r.enabled !== false)
  const byId = new Map(enabled.map((r) => [r.id!, r]))
  const defaultOrder = DEFAULT_WHATSAPP_AUTO_REPLY_RULES.map((r) => r.id).filter(Boolean) as string[]
  const orderedIds = [
    ...defaultOrder.filter((id) => byId.has(id)),
    ...enabled.map((r) => r.id!).filter((id) => !defaultOrder.includes(id)),
  ]

  return orderedIds.map((ruleId, idx) => {
    const rule = byId.get(ruleId)!
    return {
      n: idx + 1,
      ruleId,
      label: menuLabel(rule),
      hint: menuHint(rule),
    }
  })
}

/** Cliente digitou só o número da opção (ex.: "3" ou "3."). */
export function matchWhatsAppAutoReplyRuleByMenuNumber(
  messageText: string,
  rules: WhatsAppAutoReplyRule[]
): WhatsAppAutoReplyRule | null {
  const t = normalizeMenuInput(messageText)
  const m = t.match(/^(\d{1,2})\.?$/)
  if (!m) return null
  const n = Number(m[1])
  const item = buildWhatsAppAutoReplyMenuItems(rules).find((i) => i.n === n)
  if (!item) return null
  const rule = rules.find((r) => r.id === item.ruleId && r.enabled !== false)
  return rule ?? null
}

export function isWhatsAppAutoReplyMenuRequest(messageText: string): boolean {
  const t = normalizeMenuInput(messageText)
  if (!t) return false
  return MENU_TRIGGER_WORDS.some((w) => t === w || t.includes(w))
}

/** Lista numerada enviada quando a mensagem não entrou em nenhuma regra. */
export function buildWhatsAppAutoReplyMenuText(
  rules: WhatsAppAutoReplyRule[],
  barbershopName?: string
): string {
  const items = buildWhatsAppAutoReplyMenuItems(rules)
  const lines = items.map((i) => `${i.n}. ${i.label} (${i.hint})`)

  const header = barbershopName?.trim()
    ? `Olá! Atendimento automático da ${barbershopName.trim()}.`
    : "Olá! Atendimento automático."

  return [
    header,
    "",
    "Digite o número ou escreva a palavra:",
    "",
    ...lines,
  ].join("\n")
}
