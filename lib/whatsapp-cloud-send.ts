import type { WhatsAppIntegration } from "@prisma/client"

export type WhatsAppSendResult = {
  ok: boolean
  skipped?: string
  error?: string
  status?: number
  delivery?: "text" | "template" | "fallback_template"
}

/**
 * Envio via Meta Graph API (WhatsApp Cloud).
 * Precisa de `apiToken`, `graphPhoneNumberId` na integração e telefone do cliente só com dígitos (DDI).
 */
export async function sendWhatsAppText(params: {
  integration: Pick<WhatsAppIntegration, "apiToken" | "graphPhoneNumberId"> | null
  toDigits: string
  body: string
}): Promise<WhatsAppSendResult> {
  const { integration, toDigits, body } = params
  if (!integration?.apiToken?.trim() || !integration.graphPhoneNumberId?.trim()) {
    return { ok: false, skipped: "whatsapp_not_configured" }
  }
  if (toDigits.length < 10) {
    return { ok: false, skipped: "client_no_phone" }
  }
  const text = body.slice(0, 4096)
  const url = `https://graph.facebook.com/v21.0/${integration.graphPhoneNumberId.trim()}/messages`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integration.apiToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toDigits,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      return { ok: false, error: errText || res.statusText, status: res.status }
    }
    return { ok: true, status: res.status, delivery: "text" }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch_failed" }
  }
}

/** Template aprovado na Meta (ex.: hello_world no teste da Etapa 1). */
export async function sendWhatsAppTemplate(params: {
  integration: Pick<WhatsAppIntegration, "apiToken" | "graphPhoneNumberId"> | null
  toDigits: string
  templateName: string
  languageCode?: string
  bodyParameters?: string[]
  delivery?: WhatsAppSendResult["delivery"]
}): Promise<WhatsAppSendResult> {
  const { integration, toDigits, templateName, languageCode = "pt_BR", bodyParameters, delivery = "template" } =
    params
  if (!integration?.apiToken?.trim() || !integration.graphPhoneNumberId?.trim()) {
    return { ok: false, skipped: "whatsapp_not_configured" }
  }
  if (toDigits.length < 10) {
    return { ok: false, skipped: "client_no_phone" }
  }
  const name = templateName.trim()
  if (!name) {
    return { ok: false, skipped: "template_name_missing" }
  }

  const components =
    bodyParameters && bodyParameters.length > 0
      ? [
          {
            type: "body",
            parameters: bodyParameters.map((text) => ({
              type: "text",
              text: text.slice(0, 1024),
            })),
          },
        ]
      : undefined

  const url = `https://graph.facebook.com/v21.0/${integration.graphPhoneNumberId.trim()}/messages`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integration.apiToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toDigits,
        type: "template",
        template: {
          name,
          language: { code: languageCode },
          ...(components ? { components } : {}),
        },
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      return { ok: false, error: errText || res.statusText, status: res.status }
    }
    return { ok: true, status: res.status, delivery }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch_failed" }
  }
}
