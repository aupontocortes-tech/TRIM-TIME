import type { WhatsAppIntegration } from "@prisma/client"
import { whatsappDigitsForCloudApi } from "@/lib/whatsapp-phone"

/** Fallback quando a URL da instância ainda não foi resolvida. */
export const GREEN_API_BASE_URL = "https://api.greenapi.com"

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
      baseUrl: string
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
  apiUrlLabel: "apiUrl",
  apiUrlHint:
    "Opcional: copie apiUrl do console (ex.: https://7107.api.greenapi.com). Se deixar vazio, detectamos automaticamente.",
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
  "apiToken" | "graphPhoneNumberId" | "phoneNumber" | "greenApiBaseUrl"
>

export function normalizeGreenApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "")
}

/** Candidatos de apiUrl — a Green API usa host por instância (ex.: 7107.api.greenapi.com). */
export function greenApiBaseUrlCandidates(idInstance: string, explicit?: string | null): string[] {
  const id = idInstance.trim()
  const out: string[] = []
  if (explicit?.trim()) out.push(normalizeGreenApiBaseUrl(explicit))
  if (id.length >= 4) {
    out.push(`https://${id.slice(0, 4)}.api.greenapi.com`)
  }
  out.push("https://api.greenapi.com")
  out.push("https://api.green-api.com")
  return [...new Set(out)]
}

function greenApiUrl(
  baseUrl: string,
  path: string,
  idInstance: string,
  apiTokenInstance: string
): string {
  return `${normalizeGreenApiBaseUrl(baseUrl)}/waInstance${idInstance.trim()}/${path}/${apiTokenInstance.trim()}`
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

export async function resolveGreenApiBaseUrl(
  idInstance: string,
  apiTokenInstance: string,
  explicit?: string | null
): Promise<string | null> {
  const id = idInstance.trim()
  const token = apiTokenInstance.trim()
  if (!id || !token) return null

  for (const base of greenApiBaseUrlCandidates(id, explicit)) {
    try {
      const res = await fetch(greenApiUrl(base, "getWaSettings", id, token), { method: "GET" })
      if (res.ok) return base
    } catch {
      /* tenta próximo host */
    }
  }
  return null
}

export async function getGreenApiWaSettings(
  idInstance: string,
  apiTokenInstance: string,
  baseUrl?: string | null
): Promise<{ ok: true; settings: GreenApiWaSettings; baseUrl: string } | { ok: false; error: string; status?: number }> {
  const id = idInstance.trim()
  const token = apiTokenInstance.trim()
  if (!id || !token) {
    return { ok: false, error: "Informe idInstance e apiTokenInstance." }
  }

  const resolved =
    baseUrl?.trim() || (await resolveGreenApiBaseUrl(id, token))
  if (!resolved) {
    return {
      ok: false,
      error:
        "Não foi possível contactar a Green API. Confira idInstance, apiTokenInstance e apiUrl no console.",
    }
  }

  try {
    const res = await fetch(greenApiUrl(resolved, "getWaSettings", id, token), { method: "GET" })
    const json = (await res.json().catch(() => ({}))) as GreenApiWaSettings & { error?: string }
    if (!res.ok) {
      return {
        ok: false,
        error: json.error || res.statusText || "Credenciais inválidas na Green API",
        status: res.status,
      }
    }
    return { ok: true, settings: json, baseUrl: resolved }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch_failed" }
  }
}

export async function validateGreenApiCredentials(
  idInstance: string,
  apiTokenInstance: string,
  explicitBaseUrl?: string | null
): Promise<ValidateGreenApiCredentialsResult> {
  const result = await getGreenApiWaSettings(idInstance, apiTokenInstance, explicitBaseUrl)
  if (!result.ok) return { ok: false, error: result.error }
  const state = result.settings.stateInstance ?? "unknown"
  return {
    ok: true,
    stateInstance: state,
    phone: result.settings.phone?.replace(/\D/g, ""),
    readyToSend: state === "authorized",
    baseUrl: result.baseUrl,
  }
}

export async function sendGreenApiText(params: {
  integration: Pick<WhatsAppIntegration, "apiToken" | "graphPhoneNumberId" | "greenApiBaseUrl"> | null
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

  const baseUrl =
    integration?.greenApiBaseUrl?.trim() ||
    (await resolveGreenApiBaseUrl(idInstance, apiTokenInstance))
  if (!baseUrl) {
    return { ok: false, error: "green_api_base_url_unresolved" }
  }

  const message = body.slice(0, 20000)
  try {
    const res = await fetch(greenApiUrl(baseUrl, "sendMessage", idInstance, apiTokenInstance), {
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
