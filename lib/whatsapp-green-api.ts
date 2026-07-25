import type { WhatsAppIntegration } from "@prisma/client"
import { whatsappDigitsForCloudApi } from "@/lib/whatsapp-phone"

export const GREEN_API_BASE_URL = "https://api.green-api.com"

export type GreenApiStateInstance =
  | "authorized"
  | "notAuthorized"
  | "blocked"
  | "sleepMode"
  | "starting"
  | "yellowCard"
  | "suspended"
  | string

export type GreenApiWaSettings = {
  stateInstance?: GreenApiStateInstance
  phone?: string
  avatar?: string
  logoutProcess?: boolean
}

export type GreenApiSendResult = {
  ok: boolean
  skipped?: string
  error?: string
  status?: number
  delivery?: "text"
  idMessage?: string
}

export type ValidateGreenApiCredentialsResult =
  | {
      ok: true
      stateInstance: GreenApiStateInstance
      phone?: string
      readyToSend: boolean
    }
  | { ok: false; error: string }

/** Textos para o painel (rótulos alinhados ao console Green API). */
export const GREEN_API_FIELD_COPY = {
  idInstanceLabel: "idInstance",
  idInstanceHint:
    "No console Green API, abra sua instância e copie o número idInstance (ex.: 1101234567).",
  apiTokenLabel: "apiTokenInstance",
  apiTokenHint:
    "Na mesma tela, copie apiTokenInstance — é a chave secreta da instância (não compartilhe).",
  consoleUrl: "https://console.green-api.com/",
  signupUrl: "https://green-api.com/en/docs/before-start/",
  qrHint:
    "No console Green API, clique em «QR» ou «Get QR» e escaneie com o WhatsApp do celular da barbearia (Aparelhos conectados).",
  planBusinessTitle: "WhatsApp: Business",
  planBusinessPrice: "12 USD/mês",
  planBusinessDesc: "Para barbearia de verdade — vários clientes, confirmações e lembretes ilimitados.",
  planDeveloperTitle: "WhatsApp: Developer",
  planDeveloperPrice: "Grátis",
  planDeveloperDesc: "Só para testar — limite de 3 conversas por mês. Não use com clientes reais.",
} as const

export const GREEN_API_STATE_LABELS: Record<string, string> = {
  authorized: "Autorizado — pronto para enviar mensagens",
  notAuthorized: "Aguardando QR Code — escaneie no console Green API",
  starting: "Instância iniciando… aguarde alguns minutos",
  blocked: "Instância bloqueada — verifique no console Green API",
  sleepMode: "Celular offline — ligue o aparelho e aguarde até 5 minutos",
  suspended: "Conta com restrições temporárias de envio",
  yellowCard: "Conta com restrições (status antigo)",
}

export type WhatsAppIntegrationGreenFields = Pick<
  WhatsAppIntegration,
  "apiToken" | "graphPhoneNumberId" | "phoneNumber"
>

function greenApiUrl(path: string, idInstance: string, apiTokenInstance: string): string {
  return `${GREEN_API_BASE_URL}/waInstance${idInstance.trim()}/${path}/${apiTokenInstance.trim()}`
}

export function greenApiChatIdFromDigits(digits: string): string | null {
  const normalized = whatsappDigitsForCloudApi(digits)
  if (!normalized) return null
  return `${normalized}@c.us`
}

export function isGreenApiIntegrationReady(integration: WhatsAppIntegrationGreenFields | null): boolean {
  if (!integration?.apiToken?.trim() || !integration.graphPhoneNumberId?.trim()) return false
  return Boolean(integration.phoneNumber?.trim())
}

export async function getGreenApiWaSettings(
  idInstance: string,
  apiTokenInstance: string
): Promise<{ ok: true; settings: GreenApiWaSettings } | { ok: false; error: string; status?: number }> {
  const id = idInstance.trim()
  const token = apiTokenInstance.trim()
  if (!id || !token) {
    return { ok: false, error: "Informe idInstance e apiTokenInstance." }
  }
  try {
    const res = await fetch(greenApiUrl("getWaSettings", id, token), { method: "GET" })
    const json = (await res.json().catch(() => ({}))) as GreenApiWaSettings & { error?: string }
    if (!res.ok) {
      return {
        ok: false,
        error: json.error || res.statusText || "Credenciais inválidas na Green API",
        status: res.status,
      }
    }
    return { ok: true, settings: json }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch_failed" }
  }
}

export async function validateGreenApiCredentials(
  idInstance: string,
  apiTokenInstance: string
): Promise<ValidateGreenApiCredentialsResult> {
  const result = await getGreenApiWaSettings(idInstance, apiTokenInstance)
  if (!result.ok) return { ok: false, error: result.error }
  const state = result.settings.stateInstance ?? "unknown"
  return {
    ok: true,
    stateInstance: state,
    phone: result.settings.phone?.replace(/\D/g, ""),
    readyToSend: state === "authorized",
  }
}

export async function sendGreenApiText(params: {
  integration: Pick<WhatsAppIntegration, "apiToken" | "graphPhoneNumberId"> | null
  toDigits: string
  body: string
}): Promise<GreenApiSendResult> {
  const { integration, toDigits, body } = params
  const idInstance = integration?.graphPhoneNumberId?.trim()
  const apiTokenInstance = integration?.apiToken?.trim()
  if (!idInstance || !apiTokenInstance) {
    return { ok: false, skipped: "whatsapp_not_configured" }
  }

  const chatId = greenApiChatIdFromDigits(toDigits)
  if (!chatId) return { ok: false, skipped: "client_no_phone" }

  const message = body.slice(0, 20000)
  try {
    const res = await fetch(greenApiUrl("sendMessage", idInstance, apiTokenInstance), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    })
    const json = (await res.json().catch(() => ({}))) as { idMessage?: string; error?: string }
    if (!res.ok) {
      return { ok: false, error: json.error || (await res.text().catch(() => res.statusText)), status: res.status }
    }
    return { ok: true, status: res.status, delivery: "text", idMessage: json.idMessage }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch_failed" }
  }
}
