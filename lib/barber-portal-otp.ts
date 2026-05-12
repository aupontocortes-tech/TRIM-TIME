/** Placeholder na auditoria local; o código real vem do e-mail (Supabase Auth). */
export const BARBER_OTP_AUDIT_PLACEHOLDER = "****"

const OTP_TTL_MS = 10 * 60 * 1000

function envInt(name: string, fallback: number) {
  const v = process.env[name]?.trim()
  if (!v) return fallback
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const BARBER_OTP_RESEND_COOLDOWN_MS = envInt("OTP_RESEND_COOLDOWN_SECONDS", 60) * 1000
export const BARBER_OTP_MAX_SENDS_WINDOW_MS = envInt("OTP_SEND_WINDOW_MINUTES", 60) * 60 * 1000
export const BARBER_OTP_MAX_SENDS_IN_WINDOW = envInt("OTP_MAX_SENDS_PER_WINDOW", 50)

export function barberOtpExpiresAt(): Date {
  return new Date(Date.now() + OTP_TTL_MS)
}

export function normalizeBarberPortalEmail(s: string) {
  return s.trim().toLowerCase()
}

export function isSupabaseOtpThrottleMessage(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase()
  return (
    m.includes("rate limit") ||
    m.includes("too many") ||
    m.includes("exceeded") ||
    m.includes("only request") ||
    (m.includes("after ") && m.includes("second")) ||
    m.includes("for security purposes") ||
    m.includes("e-mail rate") ||
    m.includes("email rate") ||
    m.includes("frequency")
  )
}

export function friendlyBarberOtpSendError(message: string | undefined): string {
  if (isSupabaseOtpThrottleMessage(message)) {
    const sec = Math.ceil(BARBER_OTP_RESEND_COOLDOWN_MS / 1000)
    return `Muitas solicitações de código. Aguarde cerca de ${sec} segundos entre um envio e outro.`
  }
  return (message ?? "").trim() || "Não foi possível enviar o código por e-mail."
}
