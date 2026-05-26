import type { WhatsAppIntegration } from "@prisma/client"
import { sendWhatsAppText, type WhatsAppSendResult } from "@/lib/whatsapp-cloud-send"

export type { WhatsAppSendResult }

export type WhatsAppIntegrationForSend = Pick<
  WhatsAppIntegration,
  "apiToken" | "graphPhoneNumberId" | "phoneNumber" | "apiProvider"
>

export function isWhatsAppIntegrationReady(integration: WhatsAppIntegrationForSend | null): boolean {
  if (!integration?.apiToken?.trim() || !integration.phoneNumber?.trim()) return false
  return Boolean(integration.graphPhoneNumberId?.trim())
}

export async function sendWhatsAppByProvider(params: {
  integration: WhatsAppIntegrationForSend | null
  toDigits: string
  body: string
}): Promise<WhatsAppSendResult> {
  const { integration, toDigits, body } = params
  if (!integration) return { ok: false, skipped: "whatsapp_not_configured" }
  if (toDigits.length < 10) return { ok: false, skipped: "client_no_phone" }
  return sendWhatsAppText({ integration, toDigits, body })
}
