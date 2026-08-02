import type { WhatsAppAutoReplyRule } from "@/lib/db/types"

/** Itens do menu numerado (fallback quando a mensagem não bate em nenhuma regra). */
export const WHATSAPP_AUTO_REPLY_MENU_ITEMS: {
  n: number
  ruleId: string
  label: string
  hint: string
}[] = [
  { n: 1, ruleId: "endereco", label: "Endereço", hint: "ex.: onde fica" },
  { n: 2, ruleId: "horario", label: "Meu horário", hint: "ex.: meu horario" },
  { n: 3, ruleId: "confirmar", label: "Confirmar horário/vaga", hint: "ex.: confirmo" },
  { n: 4, ruleId: "lista_espera", label: "Lista de espera", hint: "ex.: minha fila" },
  { n: 5, ruleId: "cancelar_remarcar", label: "Cancelar ou remarcar", hint: "ex.: remarcar" },
  { n: 6, ruleId: "servicos", label: "Serviços e preços", hint: "ex.: quanto custa" },
  { n: 7, ruleId: "funcionamento", label: "Horário de funcionamento", hint: "ex.: que horas abre" },
  { n: 8, ruleId: "profissional_agendamento", label: "Quem vai me atender", hint: "ex.: meu barbeiro" },
  { n: 9, ruleId: "profissionais", label: "Profissionais", hint: "ex.: quais profissionais" },
  { n: 10, ruleId: "agendar", label: "Agendar", hint: "ex.: agendar" },
]

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

/** Cliente digitou só o número da opção (ex.: "3" ou "3."). */
export function matchWhatsAppAutoReplyRuleByMenuNumber(
  messageText: string,
  rules: WhatsAppAutoReplyRule[]
): WhatsAppAutoReplyRule | null {
  const t = normalizeMenuInput(messageText)
  const m = t.match(/^(\d{1,2})\.?$/)
  if (!m) return null
  const n = Number(m[1])
  const item = WHATSAPP_AUTO_REPLY_MENU_ITEMS.find((i) => i.n === n)
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
  const enabledIds = new Set(rules.filter((r) => r.enabled !== false).map((r) => r.id))
  const lines = WHATSAPP_AUTO_REPLY_MENU_ITEMS.filter((i) => enabledIds.has(i.ruleId)).map(
    (i) => `${i.n}. ${i.label} (${i.hint})`
  )

  const header = barbershopName?.trim()
    ? `Olá! Sou o atendimento automático da ${barbershopName.trim()}.`
    : "Olá! Atendimento automático."

  return [
    header,
    "",
    "Digite o número ou escreva a palavra-chave:",
    "",
    ...lines,
  ].join("\n")
}
