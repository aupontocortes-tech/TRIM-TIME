import type { WhatsAppIntegration } from "@prisma/client"
import { sendWhatsAppText, type WhatsAppSendResult } from "@/lib/whatsapp-cloud-send"

export type { WhatsAppSendResult }

export type WhatsAppIntegrationForSend = Pick<
  WhatsAppIntegration,
  "apiToken" | "graphPhoneNumberId" | "phoneNumber" | "apiProvider"
>

/**
 * Indica se há credenciais mínimas para tentar envio pela API (sem validar com a Meta/Twilio).
 */
export function isWhatsAppIntegrationReady(integration: WhatsAppIntegrationForSend | null): boolean {
  if (!integration?.apiToken?.trim() || !integration.phoneNumber?.trim()) return false
  const p = (integration.apiProvider || "meta").toLowerCase()
  if (p === "twilio") {
    const parts = integration.apiToken.trim().split("|", 2)
    return parts.length >= 2 && parts[0].startsWith("AC") && parts[1].trim().length > 0
  }
  if (p === "zenvia") return Boolean(integration.graphPhoneNumberId?.trim())
  return Boolean(integration.graphPhoneNumberId?.trim())
}

async function send360Dialog(params: {
  integration: WhatsAppIntegrationForSend
  toDigits: string
  body: string
}): Promise<WhatsAppSendResult> {
  const { integration, toDigits, body } = params
  const id = integration.graphPhoneNumberId?.trim()
  const key = integration.apiToken?.trim()
  if (!id || !key) return { ok: false, skipped: "whatsapp_not_configured" }
  const text = body.slice(0, 4096)
  const url = `https://waba-v2.360dialog.io/${id}/messages`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "D360-API-KEY": key,
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
    return { ok: true, status: res.status }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch_failed" }
  }
}

async function sendTwilioWhatsApp(params: {
  integration: WhatsAppIntegrationForSend
  toDigits: string
  body: string
}): Promise<WhatsAppSendResult> {
  const { integration, toDigits, body } = params
  const raw = integration.apiToken?.trim() ?? ""
  const [accountSid, authToken] = raw.split("|", 2)
  if (!accountSid?.startsWith("AC") || !authToken?.trim()) {
    return { ok: false, skipped: "whatsapp_not_configured" }
  }
  const fromDigits = integration.phoneNumber.replace(/\D/g, "")
  if (fromDigits.length < 10) return { ok: false, skipped: "whatsapp_not_configured" }
  const text = body.slice(0, 1600)
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const form = new URLSearchParams({
    From: `whatsapp:+${fromDigits}`,
    To: `whatsapp:+${toDigits}`,
    Body: text,
  })
  const basic = Buffer.from(`${accountSid}:${authToken.trim()}`, "utf8").toString("base64")
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      return { ok: false, error: errText || res.statusText, status: res.status }
    }
    return { ok: true, status: res.status }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch_failed" }
  }
}

async function sendZenviaWhatsApp(params: {
  integration: WhatsAppIntegrationForSend
  toDigits: string
  body: string
}): Promise<WhatsAppSendResult> {
  const { integration, toDigits, body } = params
  const token = integration.apiToken?.trim()
  const from = integration.graphPhoneNumberId?.trim()
  if (!token || !from) return { ok: false, skipped: "whatsapp_not_configured" }
  const text = body.slice(0, 4096)
  try {
    const res = await fetch("https://api.zenvia.com/v2/channels/whatsapp/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: toDigits,
        contents: [{ type: "text", text }],
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      return { ok: false, error: errText || res.statusText, status: res.status }
    }
    return { ok: true, status: res.status }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch_failed" }
  }
}

/**
 * Envio unificado: Meta Cloud (padrão), 360dialog, Twilio (SID|token no campo token) ou Zenvia.
 */
export async function sendWhatsAppByProvider(params: {
  integration: WhatsAppIntegrationForSend | null
  toDigits: string
  body: string
}): Promise<WhatsAppSendResult> {
  const { integration, toDigits, body } = params
  if (!integration) return { ok: false, skipped: "whatsapp_not_configured" }
  if (toDigits.length < 10) return { ok: false, skipped: "client_no_phone" }

  const p = (integration.apiProvider || "meta").toLowerCase()
  if (p === "twilio") return sendTwilioWhatsApp({ integration, toDigits, body })
  if (p === "zenvia") return sendZenviaWhatsApp({ integration, toDigits, body })
  if (p === "360dialog" || p === "dialog360") return send360Dialog({ integration, toDigits, body })
  return sendWhatsAppText({ integration, toDigits, body })
}
