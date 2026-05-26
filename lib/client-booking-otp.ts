import {
  sendSupabaseEmailOtp,
  verifyEmailOtpWithFallback,
} from "@/lib/supabase-auth-otp"
import { isPublicOtpLengthValid, normalizePublicOtpCode } from "@/lib/public-otp-code"
import { createAnonServerAuthClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

export type ClientBookingOtpIntent = "login" | "register" | "reset_password"

export async function sendClientBookingEmailOtp(
  email: string,
  barbershopName: string,
  intent: ClientBookingOtpIntent = "login"
): Promise<{ ok: true; otp: string } | { error: string; status: number }> {
  const shopLabel = barbershopName.trim() || "sua barbearia"
  if (intent === "reset_password") {
    return sendSupabaseEmailOtp(email, {
      subject: `Redefinir senha — ${shopLabel}`,
      intro: `Use o código abaixo para criar uma nova senha de agendamento em ${shopLabel} no Trim Time:`,
    })
  }
  return sendSupabaseEmailOtp(email, {
    subject: `Código de acesso — ${shopLabel}`,
    intro: `Use o código abaixo para entrar ou se cadastrar em ${shopLabel} no Trim Time:`,
  })
}

export function clientOtpCodeMatches(stored: string, input: string): boolean {
  const storedNorm = normalizePublicOtpCode(stored)
  const inputNorm = normalizePublicOtpCode(input)
  return (
    isPublicOtpLengthValid(storedNorm.length) &&
    storedNorm === inputNorm &&
    storedNorm.length > 0
  )
}

export async function verifyClientBookingOtpWithSupabase(
  email: string,
  token: string
): Promise<
  | { ok: true; user: NonNullable<Awaited<ReturnType<SupabaseClient["auth"]["verifyOtp"]>>["data"]["user"]> }
  | { error: string }
> {
  let supabase: SupabaseClient
  try {
    supabase = createAnonServerAuthClient()
  } catch {
    return { error: "Supabase não configurado." }
  }

  const { data, error } = await verifyEmailOtpWithFallback(supabase, { email, token })
  if (error || !data?.user) {
    const raw = error?.message?.toLowerCase() ?? ""
    if (raw.includes("expired") || raw.includes("otp_expired")) {
      return { error: "Código expirado. Peça um novo em «Receber código»." }
    }
    return {
      error:
        "Código inválido ou expirado. Confira os dígitos ou peça um novo código.",
    }
  }
  return { ok: true, user: data.user }
}
