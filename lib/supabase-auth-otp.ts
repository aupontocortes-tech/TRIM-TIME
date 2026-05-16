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

type OtpVerifyType = "signup" | "email" | "magiclink"

/** Ordem: cadastro novo (signup) e usuário já existente no Auth (magiclink). */
const VERIFY_TYPES: OtpVerifyType[] = ["signup", "magiclink", "email"]

function otpRedirectTo(): string | undefined {
  const url =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
  return url || undefined
}

/**
 * Envia OTP por e-mail via Admin API (dispara o mesmo e-mail com {{ .Token }} do Supabase).
 * `signInWithOtp` sozinho costuma mandar só "Confirm your signup" com link, sem dígitos.
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
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  })

  if (error) {
    const msg = (error.message ?? "").toLowerCase()
    if (
      msg.includes("rate limit") ||
      msg.includes("too many") ||
      msg.includes("exceeded") ||
      msg.includes("for security purposes")
    ) {
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
  params: { email: string; token: string }
) {
  let lastError: { message?: string } | null = null
  for (const type of VERIFY_TYPES) {
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
