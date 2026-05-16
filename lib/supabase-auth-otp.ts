import type { SupabaseClient } from "@supabase/supabase-js"

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

const VERIFY_TYPES: OtpVerifyType[] = ["signup", "email", "magiclink"]

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
