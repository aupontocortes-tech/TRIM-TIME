import { prisma } from "@/lib/prisma"
import { sendClientBookingEmailOtp, type ClientBookingOtpIntent } from "@/lib/client-booking-otp"
import { createAnonServerAuthClient } from "@/lib/supabase/server"
import { normalizePublicOtpCode } from "@/lib/public-otp-code"

export type DispatchClientOtpResult =
  | { ok: true; delivery: "resend" | "supabase_auth" }
  | { error: string; status: number }

function isSupabaseOtpThrottleMessage(message: string | undefined): boolean {
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

/**
 * Envia OTP por e-mail (Resend + código no DB, ou Supabase Auth) e registra auditoria.
 */
export async function dispatchClientBookingOtp(input: {
  barbershopId: string
  slug: string
  email: string
  intent: ClientBookingOtpIntent
  expiresAt: Date
  nome?: string | null
  telefone?: string | null
  shopName: string
}): Promise<DispatchClientOtpResult> {
  const email = input.email.trim().toLowerCase()
  const sent = await sendClientBookingEmailOtp(email, input.shopName, input.intent)

  if (!("error" in sent)) {
    const code = normalizePublicOtpCode(sent.otp)
    try {
      await prisma.clientOtpCode.create({
        data: {
          barbershopId: input.barbershopId,
          email,
          code,
          expiresAt: input.expiresAt,
          intent: input.intent,
          nome: input.nome ?? null,
          telefone: input.telefone ?? null,
        },
      })
      return { ok: true, delivery: "resend" }
    } catch (e) {
      console.error("[client otp] persist resend code:", e)
      try {
        await prisma.clientOtpCode.create({
          data: {
            barbershopId: input.barbershopId,
            email,
            code: "****",
            expiresAt: input.expiresAt,
            intent: input.intent,
            nome: input.nome ?? null,
            telefone: input.telefone ?? null,
          },
        })
      } catch {
        /* rate limit row optional */
      }
      return { ok: true, delivery: "resend" }
    }
  }

  let supabase
  try {
    supabase = createAnonServerAuthClient()
  } catch {
    return {
      error:
        ("error" in sent ? sent.error : null) ||
        "Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL e ANON_KEY).",
      status: "error" in sent && sent.status >= 500 ? sent.status : 500,
    }
  }

  const metadata: Record<string, string> = {
    intent: input.intent,
    barbershop_slug: input.slug,
  }
  if (input.intent === "register" && input.nome && input.telefone) {
    metadata.nome = input.nome
    metadata.telefone = input.telefone
  }

  const { error: authErr } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: input.intent === "register",
      data: metadata,
    },
  })

  if (authErr) {
    const throttled = isSupabaseOtpThrottleMessage(authErr.message)
    const sec = 60
    return {
      error: throttled
        ? `Muitas solicitações. Aguarde cerca de ${sec}s e tente de novo. Confira também o spam.`
        : (authErr.message ?? "").trim() || "Não foi possível enviar o código por e-mail.",
      status: throttled ? 429 : 400,
    }
  }

  try {
    await prisma.clientOtpCode.create({
      data: {
        barbershopId: input.barbershopId,
        email,
        code: "****",
        expiresAt: input.expiresAt,
        intent: input.intent,
        nome: input.intent === "register" ? input.nome ?? null : null,
        telefone: input.intent === "register" ? input.telefone ?? null : null,
      },
    })
  } catch (e) {
    console.error("[client otp] persist supabase audit:", e)
  }

  return { ok: true, delivery: "supabase_auth" }
}
