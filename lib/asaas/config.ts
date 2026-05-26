export type AsaasEnvironment = "sandbox" | "production"

export function getAsaasEnvironment(): AsaasEnvironment {
  const v = process.env.ASAAS_ENVIRONMENT?.trim().toLowerCase()
  return v === "production" ? "production" : "sandbox"
}

export function getAsaasApiBaseUrl(): string {
  return getAsaasEnvironment() === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3"
}

export function getAsaasApiKey(): string | null {
  const key = process.env.ASAAS_API_KEY?.trim()
  return key || null
}

export function isAsaasConfigured(): boolean {
  return !!getAsaasApiKey()
}

export function getAsaasWebhookToken(): string | null {
  return process.env.ASAAS_WEBHOOK_TOKEN?.trim() || null
}

export function getAppBaseUrl(): string {
  const vercel = process.env.VERCEL_URL?.trim()
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (vercel ? `https://${vercel}` : "") ||
    "http://localhost:3000"
  return base.replace(/\/$/, "")
}
