import type { WhatsAppAutoReplyRule, WhatsAppAutoReplySettings } from "@/lib/db/types"
import { DEFAULT_WHATSAPP_AUTO_REPLY_RULES } from "@/lib/whatsapp-auto-reply-defaults"

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function resolveWhatsAppAutoReplyRules(
  settings: WhatsAppAutoReplySettings | null | undefined
): WhatsAppAutoReplyRule[] {
  const custom = settings?.rules?.filter((r) => r.keywords?.length && r.reply_template?.trim())
  if (custom?.length) {
    return custom.map((r) => ({
      id: r.id || `rule-${r.keywords[0]}`,
      enabled: r.enabled !== false,
      keywords: r.keywords.map((k) => k.trim()).filter(Boolean),
      reply_template: r.reply_template.trim(),
    }))
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
    const quoted = md.quotedMessage as Record<string, unknown> | undefined
    const text = quoted?.textMessage
    return typeof text === "string" ? text.trim() : null
  }

  return null
}
