import type { WhatsAppIntegration } from "@prisma/client"
import { brWhatsappCheckCandidates, whatsappDigitsForCloudApi } from "@/lib/whatsapp-phone"
import { resolvePublicBookingOrigin } from "@/lib/booking-public-url"

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
  /** Metadados do checkWhatsapp (diagnóstico). */
  checkWhatsapp?: {
    existsWhatsapp?: boolean
    chatId?: string
    fromCache?: boolean
  }
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
  yellowCard: "Restrição temporária de envio (yellowCard) — aguarde ou verifique no console Green API",
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

  const baseUrl =
    integration?.greenApiBaseUrl?.trim() ||
    (await resolveGreenApiBaseUrl(idInstance, apiTokenInstance))
  if (!baseUrl) {
    return { ok: false, error: "green_api_base_url_unresolved" }
  }

  const waState = await getGreenApiWaSettings(idInstance, apiTokenInstance, baseUrl)
  if (waState.ok) {
    const state = waState.settings.stateInstance
    if (state && state !== "authorized") {
      const label = GREEN_API_STATE_LABELS[state] ?? `Status da instância: ${state}`
      return { ok: false, error: label, skipped: "whatsapp_instance_not_ready" }
    }
  }

  const phoneCandidates = brWhatsappCheckCandidates(toDigits)
  if (phoneCandidates.length === 0) return { ok: false, skipped: "client_no_phone" }

  let chatId: string | null = greenApiChatIdFromDigits(toDigits)
  let checkMeta: GreenApiSendResult["checkWhatsapp"]
  let resolvedPhone: string | null = null
  try {
    const runCheck = async (phoneNumber: string, force?: boolean) => {
      const checkRes = await fetch(greenApiUrl(baseUrl, "checkWhatsapp", idInstance, apiTokenInstance), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(force ? { phoneNumber, force: true } : { phoneNumber }),
      })
      return (await checkRes.json().catch(() => ({}))) as {
        existsWhatsapp?: boolean
        chatId?: string
        fromCache?: boolean
        message?: string
      }
    }

    for (const phoneNumber of phoneCandidates) {
      let checkJson = await runCheck(phoneNumber, false)
      if (checkJson.existsWhatsapp === false && checkJson.fromCache !== false) {
        checkJson = await runCheck(phoneNumber, true)
      }
      checkMeta = {
        existsWhatsapp: checkJson.existsWhatsapp,
        chatId: checkJson.chatId,
        fromCache: checkJson.fromCache,
      }
      if (checkJson.chatId?.trim()) {
        chatId = checkJson.chatId.trim()
        resolvedPhone = phoneNumber
        break
      }
      if (checkJson.existsWhatsapp === true) {
        resolvedPhone = phoneNumber
        chatId = greenApiChatIdFromDigits(phoneNumber)
        break
      }
    }

    if (!resolvedPhone && checkMeta?.existsWhatsapp === false) {
      return {
        ok: false,
        skipped: "whatsapp_number_not_registered",
        error:
          "Este número não está registrado no WhatsApp (confirmado pela Green API). Confira em Ajustes → Conta do WhatsApp se o número é o mesmo do cadastro.",
        checkWhatsapp: checkMeta,
      }
    }
  } catch {
    /* segue com chatId @c.us */
  }

  if (!chatId) return { ok: false, skipped: "client_no_phone" }

  const message = body.slice(0, 20000)
  try {
    const res = await fetch(greenApiUrl(baseUrl, "sendMessage", idInstance, apiTokenInstance), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    })
    const json = (await res.json().catch(() => ({}))) as {
      idMessage?: string
      error?: string
      message?: string
      invokeStatus?: { description?: string }
    }
    if (!res.ok || res.status === 466) {
      const detail =
        json.invokeStatus?.description ||
        json.message ||
        json.error ||
        (typeof json === "object" ? JSON.stringify(json) : res.statusText)
      return { ok: false, error: detail, status: res.status, checkWhatsapp: checkMeta }
    }
    return { ok: true, status: res.status, delivery: "text", idMessage: json.idMessage, checkWhatsapp: checkMeta }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch_failed" }
  }
}

export function buildGreenApiWebhookUrl(): string {
  const origin = resolvePublicBookingOrigin()
  const secret = process.env.GREEN_API_WEBHOOK_SECRET?.trim()
  const base = `${origin}/api/webhooks/green-api`
  if (!secret) return base
  return `${base}?secret=${encodeURIComponent(secret)}`
}

/** Registra URL de webhook na Green API para receber mensagens dos clientes. */
export async function configureGreenApiInboundWebhook(params: {
  idInstance: string
  apiTokenInstance: string
  baseUrl?: string | null
}): Promise<{ ok: boolean; webhookUrl?: string; error?: string }> {
  const id = params.idInstance.trim()
  const token = params.apiTokenInstance.trim()
  if (!id || !token) return { ok: false, error: "missing_credentials" }

  const baseUrl =
    params.baseUrl?.trim() || (await resolveGreenApiBaseUrl(id, token))
  if (!baseUrl) return { ok: false, error: "green_api_base_url_unresolved" }

  const webhookUrl = buildGreenApiWebhookUrl()
  try {
    const res = await fetch(greenApiUrl(baseUrl, "setSettings", id, token), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookUrl,
        incomingWebhook: "yes",
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { saveSettings?: boolean; error?: string }
    if (!res.ok || json.saveSettings === false) {
      return { ok: false, webhookUrl, error: json.error || res.statusText || "set_settings_failed" }
    }
    return { ok: true, webhookUrl }
  } catch (e) {
    return { ok: false, webhookUrl, error: e instanceof Error ? e.message : "fetch_failed" }
  }
}
