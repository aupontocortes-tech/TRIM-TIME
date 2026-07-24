import type { WhatsAppIntegration } from "@prisma/client"
import {
  sendWhatsAppTemplate,
  sendWhatsAppText,
  type WhatsAppSendResult,
} from "@/lib/whatsapp-cloud-send"
import {
  META_WHATSAPP_FALLBACK_TEMPLATE,
} from "@/lib/whatsapp-meta-templates"
import { whatsappDigitsForCloudApi } from "@/lib/whatsapp-phone"

export type { WhatsAppSendResult }

export type WhatsAppIntegrationForSend = Pick<
  WhatsAppIntegration,
  "apiToken" | "graphPhoneNumberId" | "phoneNumber"
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
  return sendWhatsAppNotification({
    integration: params.integration,
    toDigits: params.toDigits,
    body: params.body,
  })
}

/**
 * Envio Meta Cloud: tenta template aprovado, depois texto livre (janela 24h), depois hello_world.
 */
export async function sendWhatsAppNotification(params: {
  integration: WhatsAppIntegrationForSend | null
  toDigits: string
  body: string
  metaTemplateName?: string | null
  metaTemplateBodyParams?: string[]
  metaTemplateLanguage?: string
}): Promise<WhatsAppSendResult> {
  const { integration, body, metaTemplateName, metaTemplateBodyParams, metaTemplateLanguage } = params
  if (!integration) return { ok: false, skipped: "whatsapp_not_configured" }
  const normalized = whatsappDigitsForCloudApi(params.toDigits)
  if (!normalized) return { ok: false, skipped: "client_no_phone" }

  const customTemplate = metaTemplateName?.trim()
  if (customTemplate) {
    const templateResult = await sendWhatsAppTemplate({
      integration,
      toDigits: normalized,
      templateName: customTemplate,
      languageCode: metaTemplateLanguage ?? "pt_BR",
      bodyParameters: metaTemplateBodyParams,
      delivery: "template",
    })
    if (templateResult.ok) return templateResult
  }

  const textResult = await sendWhatsAppText({ integration, toDigits: normalized, body })
  if (textResult.ok) return textResult

  const fallbackResult = await sendWhatsAppTemplate({
    integration,
    toDigits: normalized,
    templateName: META_WHATSAPP_FALLBACK_TEMPLATE.name,
    languageCode: META_WHATSAPP_FALLBACK_TEMPLATE.languageCode,
    delivery: "fallback_template",
  })
  if (fallbackResult.ok) return fallbackResult

  return textResult.ok === false ? textResult : fallbackResult
}
