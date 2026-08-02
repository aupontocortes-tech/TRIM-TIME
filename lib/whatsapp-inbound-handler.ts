import { prisma } from "@/lib/prisma"
import type { BarbershopSettings } from "@/lib/db/types"
import { sendGreenApiText } from "@/lib/whatsapp-green-api"
import {
  buildWhatsAppAutoReplyContext,
  renderWhatsAppAutoReplyTemplate,
} from "@/lib/whatsapp-auto-reply-context"
import {
  extractGreenApiIncomingText,
  isWhatsAppAutoReplyEnabled,
  matchWhatsAppAutoReplyRule,
  resolveWhatsAppAutoReplyRules,
} from "@/lib/whatsapp-auto-reply-engine"

function unwrapGreenApiBody(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null
  const root = payload as Record<string, unknown>
  if (root.typeWebhook && typeof root.typeWebhook === "string") return root
  const body = root.body
  if (body && typeof body === "object") return body as Record<string, unknown>
  return root
}

function extractSenderPhone(senderData: unknown): string | null {
  if (!senderData || typeof senderData !== "object") return null
  const sd = senderData as Record<string, unknown>
  const raw = (sd.sender ?? sd.chatId) as string | undefined
  if (!raw || typeof raw !== "string") return null
  const digits = raw.replace(/\D/g, "")
  return digits.length >= 10 ? digits : null
}

function isGroupChat(senderData: unknown): boolean {
  if (!senderData || typeof senderData !== "object") return false
  const chatId = (senderData as Record<string, unknown>).chatId
  return typeof chatId === "string" && chatId.endsWith("@g.us")
}

function isMessageFromInstance(body: Record<string, unknown>): boolean {
  const instanceData = body.instanceData
  if (!instanceData || typeof instanceData !== "object") return false
  const wid = (instanceData as Record<string, unknown>).wid
  if (typeof wid !== "string" || !wid) return false

  const senderData = body.senderData
  if (!senderData || typeof senderData !== "object") return false
  const sender = (senderData as Record<string, unknown>).sender ?? (senderData as Record<string, unknown>).chatId
  return typeof sender === "string" && sender === wid
}

export type GreenApiInboundResult = {
  handled: boolean
  skipped?: string
  ruleId?: string
  sendOk?: boolean
}

export async function handleGreenApiInboundWebhook(payload: unknown): Promise<GreenApiInboundResult> {
  const body = unwrapGreenApiBody(payload)
  if (!body) return { handled: false, skipped: "invalid_payload" }

  if (body.typeWebhook !== "incomingMessageReceived") {
    return { handled: false, skipped: "ignored_webhook_type" }
  }

  if (isGroupChat(body.senderData)) {
    return { handled: false, skipped: "group_chat" }
  }

  if (isMessageFromInstance(body)) {
    return { handled: false, skipped: "from_instance" }
  }

  const text = extractGreenApiIncomingText(body)
  if (!text) return { handled: false, skipped: "no_text" }

  const instanceData = body.instanceData
  if (!instanceData || typeof instanceData !== "object") {
    return { handled: false, skipped: "no_instance" }
  }
  const idInstance = String((instanceData as Record<string, unknown>).idInstance ?? "").trim()
  if (!idInstance) return { handled: false, skipped: "no_instance_id" }

  const integration = await prisma.whatsAppIntegration.findFirst({
    where: { graphPhoneNumberId: idInstance },
    include: {
      barbershop: {
        select: {
          id: true,
          name: true,
          slug: true,
          settings: true,
          suspendedAt: true,
        },
      },
    },
  })

  if (!integration?.apiToken?.trim() || !integration.barbershop || integration.barbershop.suspendedAt) {
    return { handled: false, skipped: "integration_not_found" }
  }

  const settings = integration.barbershop.settings as BarbershopSettings | null
  const autoReplySettings = settings?.notification_settings?.whatsapp_auto_replies

  if (!isWhatsAppAutoReplyEnabled(autoReplySettings)) {
    return { handled: false, skipped: "auto_reply_disabled" }
  }

  const rules = resolveWhatsAppAutoReplyRules(autoReplySettings)
  const rule = matchWhatsAppAutoReplyRule(text, rules)
  if (!rule) return { handled: false, skipped: "no_keyword_match" }

  const senderPhone = extractSenderPhone(body.senderData)
  if (!senderPhone) return { handled: false, skipped: "no_sender_phone" }

  console.info("[whatsapp-inbound] senderPhone", senderPhone, "text", text.slice(0, 60))

  const senderData = body.senderData as Record<string, unknown> | undefined
  const senderName =
    typeof senderData?.senderContactName === "string"
      ? senderData.senderContactName
      : typeof senderData?.senderName === "string"
        ? senderData.senderName
        : null

  const vars = await buildWhatsAppAutoReplyContext({
    barbershopId: integration.barbershop.id,
    barbershopName: integration.barbershop.name,
    slug: integration.barbershop.slug,
    senderPhone,
    senderName,
    settings,
  })

  const replyBody = renderWhatsAppAutoReplyTemplate(rule.reply_template, vars)
  if (!replyBody) return { handled: false, skipped: "empty_reply" }

  const send = await sendGreenApiText({
    integration,
    toDigits: senderPhone,
    body: replyBody,
  })

  const result: GreenApiInboundResult = {
    handled: true,
    ruleId: rule.id,
    sendOk: send.ok,
    skipped: send.ok ? undefined : send.error ?? send.skipped,
  }
  console.info("[whatsapp-inbound]", {
    barbershopId: integration.barbershop.id,
    ruleId: rule.id,
    textPreview: text.slice(0, 80),
    ...result,
  })
  return result
}
