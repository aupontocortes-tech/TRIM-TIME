import type { SupabaseClient } from "@supabase/supabase-js"
import { createAnonServerAuthClient, createServiceRoleClient } from "@/lib/supabase/server"

/**
 * GoTrue pode enviar link de confirmação em vez de código quando `options.data` é passado
 * em signInWithOtp para usuários novos. Metadados devem ser gravados após verify (admin) ou
 * validados só no backend (auditoria local).
 */
export function painelSignupOtpSendOptions() {
  return {
    shouldCreateUser: true as const,
  }
}

type OtpVerifyType = "signup" | "email" | "magiclink" | "invite" | "recovery"

/**
 * Ordem para cadastro:
 * - invite: e-mail novo (template "Invite", costuma ter {{ .Token }} como Recovery)
 * - signup / magiclink: usuário já criado no Auth em tentativa anterior
 */
const PAINEL_SIGNUP_VERIFY_TYPES: OtpVerifyType[] = [
  "invite",
  "signup",
  "magiclink",
  "email",
  "recovery",
]

function otpRedirectTo(): string | undefined {
  const url =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
  return url || undefined
}

function isSupabaseRateLimit(message: string | undefined): boolean {
  const msg = (message ?? "").toLowerCase()
  return (
    msg.includes("rate limit") ||
    msg.includes("too many") ||
    msg.includes("exceeded") ||
    msg.includes("for security purposes")
  )
}

function isInviteUserAlreadyRegistered(message: string | undefined): boolean {
  const msg = (message ?? "").toLowerCase()
  return msg.includes("already been registered") || msg.includes("already registered")
}

/**
 * Envia OTP por e-mail via Admin API.
 * Cadastro novo: `invite` (não usa o template "Confirm signup", que muitas vezes só manda link).
 * E-mail já no Auth: `magiclink` (template Magic Link / signup).
 * Recuperação de senha usa `recovery` — outro fluxo; por isso "esqueci senha" funcionava e cadastro não.
 */
export async function sendSupabaseEmailOtp(
  email: string
): Promise<{ ok: true } | { error: string; status: number }> {
  let admin
  try {
    admin = createServiceRoleClient()
  } catch {
    return {
      error:
        "Servidor sem SUPABASE_SERVICE_ROLE_KEY — necessário para enviar o código de cadastro.",
      status: 500,
    }
  }

  const redirectTo = otpRedirectTo()
  const linkOpts = redirectTo ? { redirectTo } : undefined

  let data: Awaited<ReturnType<typeof admin.auth.admin.generateLink>>["data"]
  let error: Awaited<ReturnType<typeof admin.auth.admin.generateLink>>["error"]

  const invite = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: linkOpts,
  })
  data = invite.data
  error = invite.error

  if (error && isInviteUserAlreadyRegistered(error.message)) {
    const magic = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: linkOpts,
    })
    data = magic.data
    error = magic.error
  }

  if (error) {
    if (isSupabaseRateLimit(error.message)) {
      return {
        error: "Muitas solicitações de código. Aguarde cerca de 60 segundos e tente de novo.",
        status: 429,
      }
    }
    return {
      error: (error.message ?? "").trim() || "Não foi possível enviar o código por e-mail.",
      status: 400,
    }
  }

  const otp = data?.properties?.email_otp
  if (!otp) {
    return {
      error:
        "O provedor de e-mail não gerou código OTP. Confira Authentication → Email no Supabase.",
      status: 502,
    }
  }

  return { ok: true }
}

/**
 * Fallback legado (menos confiável para cadastro novo).
 */
export async function sendSupabaseEmailOtpLegacyAnon(email: string) {
  const supabase = createAnonServerAuthClient()
  return supabase.auth.signInWithOtp({
    email,
    options: painelSignupOtpSendOptions(),
  })
}

/**
 * Tenta tipos de verify compatíveis com OTP por e-mail (cadastro novo vs login).
 */
export async function verifyEmailOtpWithFallback(
  supabase: SupabaseClient,
  params: { email: string; token: string },
  types: OtpVerifyType[] = PAINEL_SIGNUP_VERIFY_TYPES
) {
  let lastError: { message?: string } | null = null
  for (const type of types) {
    const { data, error } = await supabase.auth.verifyOtp({
      email: params.email,
      token: params.token,
      type,
    })
    if (!error && data.user) {
      return { data, error: null as null, type }
    }
    lastError = error
  }
  return { data: null, error: lastError, type: null as OtpVerifyType | null }
}
