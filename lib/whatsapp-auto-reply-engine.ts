import type { WhatsAppAutoReplyRule, WhatsAppAutoReplySettings } from "@/lib/db/types"
import { DEFAULT_WHATSAPP_AUTO_REPLY_RULES } from "@/lib/whatsapp-auto-reply-defaults"

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bindereco\b/g, "endereco")
    .replace(/\bagendamentos?\b/g, "agendar")
    .replace(/\s+/g, " ")
    .trim()
}

function mergeRuleWithDefault(
  custom: WhatsAppAutoReplyRule,
  defaultRule?: WhatsAppAutoReplyRule
): WhatsAppAutoReplyRule {
  if (!defaultRule) return custom
  const keywords = [...new Set([...custom.keywords, ...defaultRule.keywords])]
  return {
    ...custom,
    keywords,
    reply_template: custom.reply_template.trim() || defaultRule.reply_template.trim(),
  }
}

function normalizeAutoReplyRule(r: WhatsAppAutoReplyRule): WhatsAppAutoReplyRule {
  return {
    id: r.id || `rule-${r.keywords[0]}`,
    enabled: r.enabled !== false,
    keywords: r.keywords.map((k) => k.trim()).filter(Boolean),
    reply_template: r.reply_template.trim(),
  }
}

export function resolveWhatsAppAutoReplyRules(
  settings: WhatsAppAutoReplySettings | null | undefined
): WhatsAppAutoReplyRule[] {
  const custom = settings?.rules?.filter((r) => r.keywords?.length && r.reply_template?.trim())
  if (custom?.length) {
    const defaultById = new Map(
      DEFAULT_WHATSAPP_AUTO_REPLY_RULES.filter((d) => d.id).map((d) => [d.id!, normalizeAutoReplyRule(d)])
    )
    const normalized = custom.map((r) => {
      const base = normalizeAutoReplyRule(r)
      const def = r.id ? defaultById.get(r.id) : undefined
      return mergeRuleWithDefault(base, def)
    })
    const ids = new Set(normalized.map((r) => r.id))
    const missing = DEFAULT_WHATSAPP_AUTO_REPLY_RULES.filter((d) => d.id && !ids.has(d.id)).map(
      normalizeAutoReplyRule
    )
    return missing.length ? [...normalized, ...missing] : normalized
  }
  return DEFAULT_WHATSAPP_AUTO_REPLY_RULES
}

export function isWhatsAppAutoReplyEnabled(settings: WhatsAppAutoReplySettings | null | undefined): boolean {
  if (settings?.enabled === false) return false
  return true
}

/** Primeira regra cuja palavra-chave aparece na mensagem do cliente. */
export function matchWhatsAppAutoReplyRule(
  messageText: string,
  rules: WhatsAppAutoReplyRule[]
): WhatsAppAutoReplyRule | null {
  const normalized = normalizeForMatch(messageText)
  if (!normalized) return null

  for (const rule of rules) {
    if (rule.enabled === false) continue
    for (const keyword of rule.keywords) {
      const nk = normalizeForMatch(keyword)
      if (!nk) continue
      if (normalized.includes(nk)) return rule
    }
  }
  return null
}

const GREEN_API_AUDIO_MESSAGE_TYPES = new Set(["audioMessage", "pttMessage"])

/** Resposta automática quando o cliente manda áudio (não processamos voz). */
export const WHATSAPP_AUDIO_ONLY_REPLY_TEXT =
  "Só atendemos por *texto* — áudio não funciona aqui.\nDigite sua pergunta (ex.: agendar, onde fica, meu horário)."

export function getGreenApiIncomingMessageKind(
  body: Record<string, unknown>
): "text" | "audio" | "unsupported" {
  const messageData = body.messageData
  if (!messageData || typeof messageData !== "object") return "unsupported"
  const type = (messageData as Record<string, unknown>).typeMessage
  if (typeof type === "string" && GREEN_API_AUDIO_MESSAGE_TYPES.has(type)) return "audio"
  if (extractGreenApiIncomingText(body)) return "text"
  return "unsupported"
}

export function extractGreenApiIncomingText(body: Record<string, unknown>): string | null {
  const messageData = body.messageData
  if (!messageData || typeof messageData !== "object") return null
  const md = messageData as Record<string, unknown>
  const type = md.typeMessage

  if (type === "textMessage") {
    const textData = md.textMessageData as Record<string, unknown> | undefined
    const text = textData?.textMessage
    return typeof text === "string" ? text.trim() : null
  }

  if (type === "extendedTextMessage") {
    const textData = md.extendedTextMessageData as Record<string, unknown> | undefined
    const text = textData?.text
    return typeof text === "string" ? text.trim() : null
  }

  if (type === "quotedMessage") {
    const extended = md.extendedTextMessageData as Record<string, unknown> | undefined
    const replyText = extended?.text
    if (typeof replyText === "string" && replyText.trim()) return replyText.trim()
    const quoted = md.quotedMessage as Record<string, unknown> | undefined
    const text = quoted?.textMessage
    return typeof text === "string" ? text.trim() : null
  }

  return null
}
