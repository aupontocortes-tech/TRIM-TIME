import type { SupabaseClient } from "@supabase/supabase-js"
import { isResendOtpConfigured, sendOtpCodeEmail } from "@/lib/otp-email-send"
import { createAnonServerAuthClient, createServiceRoleClient } from "@/lib/supabase/server"

export function painelSignupOtpSendOptions() {
  return {
    shouldCreateUser: true as const,
  }
}

type OtpVerifyType = "signup" | "email" | "magiclink" | "invite" | "recovery"

const PAINEL_SIGNUP_VERIFY_TYPES: OtpVerifyType[] = [
  "invite",
  "signup",
  "magiclink",
  "email",
  "recovery",
]

const RATE_LIMIT_MSG =
  "O Supabase bloqueou envios de e-mail (limite atingido). Aguarde cerca de 1 hora, aumente os limites em Authentication → Rate limits ou configure SMTP em Providers → Email."

function isSupabaseRateLimit(message: string | undefined): boolean {
  const msg = (message ?? "").toLowerCase()
  return (
    msg.includes("rate limit") ||
    msg.includes("too many") ||
    msg.includes("exceeded") ||
    msg.includes("for security purposes") ||
    (msg.includes("after ") && msg.includes("second"))
  )
}

function isInviteUserAlreadyRegistered(message: string | undefined): boolean {
  const msg = (message ?? "").toLowerCase()
  return msg.includes("already been registered") || msg.includes("already registered")
}

export type SendSupabaseEmailOtpResult =
  | { ok: true; otp: string }
  | { error: string; status: number }

/**
 * Obtém OTP do Supabase Auth e entrega por e-mail (Resend, se configurado, senão template Invite do Supabase).
 */
export async function sendSupabaseEmailOtp(email: string): Promise<SendSupabaseEmailOtpResult> {
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

  let data: Awaited<ReturnType<typeof admin.auth.admin.generateLink>>["data"]
  let error: Awaited<ReturnType<typeof admin.auth.admin.generateLink>>["error"]

  const invite = await admin.auth.admin.generateLink({
    type: "invite",
    email,
  })
  data = invite.data
  error = invite.error

  if (error && isInviteUserAlreadyRegistered(error.message)) {
    const magic = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    })
    data = magic.data
    error = magic.error
  }

  if (error) {
    if (isSupabaseRateLimit(error.message)) {
      return { error: RATE_LIMIT_MSG, status: 429 }
    }
    return {
      error: (error.message ?? "").trim() || "Não foi possível gerar o código.",
      status: 400,
    }
  }

  const otp = data?.properties?.email_otp
  if (!otp) {
    return {
      error:
        "O Supabase não gerou código OTP. Confira Authentication → Email e os templates com {{ .Token }}.",
      status: 502,
    }
  }

  if (isResendOtpConfigured()) {
    const mailed = await sendOtpCodeEmail({
      to: email,
      code: otp,
      subject: "Código de cadastro — Trim Time",
      intro: "Seu código para cadastrar sua barbearia no Trim Time:",
    })
    if (mailed.ok) {
      return { ok: true, otp }
    }
    return { error: mailed.error, status: 502 }
  }

  const inviteMail = await admin.auth.admin.inviteUserByEmail(email)
  if (inviteMail.error) {
    if (isSupabaseRateLimit(inviteMail.error.message)) {
      return { error: RATE_LIMIT_MSG, status: 429 }
    }
    if (isInviteUserAlreadyRegistered(inviteMail.error.message)) {
      const magicSend = await createAnonServerAuthClient().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })
      if (!magicSend.error) {
        return { ok: true, otp }
      }
      if (isSupabaseRateLimit(magicSend.error.message)) {
        return { error: RATE_LIMIT_MSG, status: 429 }
      }
    }
    console.warn("[painel-signup] inviteUserByEmail:", inviteMail.error.message)
    return {
      error:
        "Não foi possível enviar o e-mail. Configure RESEND_API_KEY no servidor ou SMTP em Supabase → Authentication → Email.",
      status: 502,
    }
  }

  return { ok: true, otp }
}

export async function sendSupabaseEmailOtpLegacyAnon(email: string) {
  const supabase = createAnonServerAuthClient()
  return supabase.auth.signInWithOtp({
    email,
    options: painelSignupOtpSendOptions(),
  })
}

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
