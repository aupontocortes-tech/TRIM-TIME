import type { WhatsAppIntegration } from "@prisma/client"
import {
  isGreenApiIntegrationReady,
  sendGreenApiText,
  type GreenApiSendResult,
} from "@/lib/whatsapp-green-api"
import { whatsappDigitsForCloudApi } from "@/lib/whatsapp-phone"

export type WhatsAppSendResult = GreenApiSendResult

export type WhatsAppIntegrationForSend = Pick<
  WhatsAppIntegration,
  "apiToken" | "graphPhoneNumberId" | "phoneNumber"
>

export function isWhatsAppIntegrationReady(integration: WhatsAppIntegrationForSend | null): boolean {
  return isGreenApiIntegrationReady(integration)
}

export async function sendWhatsAppByProvider(params: {
  integration: WhatsAppIntegrationForSend | null
  toDigits: string
  body: string
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppNotification({
    integration: params.integration,
    toDigits: params.toDigits,
    body: params.body,
  })
}

/** Envio via Green API — texto livre (confirmação, lembrete, pós-atendimento). */
export async function sendWhatsAppNotification(params: {
  integration: WhatsAppIntegrationForSend | null
  toDigits: string
  body: string
}): Promise<WhatsAppSendResult> {
  const { integration, body } = params
  if (!integration) return { ok: false, skipped: "whatsapp_not_configured" }
  const normalized = whatsappDigitsForCloudApi(params.toDigits)
  if (!normalized) return { ok: false, skipped: "client_no_phone" }

  return sendGreenApiText({ integration, toDigits: normalized, body })
}
