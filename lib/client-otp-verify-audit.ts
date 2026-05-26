import { prisma } from "@/lib/prisma"
import {
  clientOtpCodeMatches,
  verifyClientBookingOtpWithSupabase,
} from "@/lib/client-booking-otp"

export type ClientOtpIntent = "login" | "register" | "reset_password"

function normalizeEmail(s: string) {
  return s.trim().toLowerCase()
}

function asStr(v: unknown) {
  return typeof v === "string" ? v.trim() : ""
}

/**
 * Valida OTP de agendamento (auditoria local + fallback Supabase) e apaga registros usados.
 */
export async function verifyClientOtpAudit(input: {
  barbershopId: string
  slug: string
  email: string
  token: string
  expectedIntent: ClientOtpIntent
}): Promise<
  | { ok: true; resolvedIntent: ClientOtpIntent; meta: Record<string, unknown> }
  | { error: string; status: number }
> {
  const email = normalizeEmail(input.email)
  const token = input.token

  const audit = await prisma.clientOtpCode.findFirst({
    where: { barbershopId: input.barbershopId, email },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, expiresAt: true, intent: true },
  })

  if (!audit) {
    return {
      error: "Não há envio registrado para este e-mail. Peça um novo código.",
      status: 400,
    }
  }

  const dbCodeOk =
    clientOtpCodeMatches(audit.code, token) && audit.expiresAt.getTime() > Date.now()

  let meta: Record<string, unknown> = {}
  let resolvedIntent: ClientOtpIntent =
    audit.intent === "login"
      ? "login"
      : audit.intent === "reset_password"
        ? "reset_password"
        : "register"

  if (!dbCodeOk) {
    const supa = await verifyClientBookingOtpWithSupabase(email, token)
    if ("error" in supa) {
      return { error: supa.error, status: 401 }
    }
    const user = supa.user
    const userEmail = user.email ? normalizeEmail(user.email) : ""
    if (!userEmail || userEmail !== email) {
      return { error: "E-mail não confere com o código.", status: 400 }
    }
    meta = (user.user_metadata || {}) as Record<string, unknown>
    const metaSlug = asStr(meta.barbershop_slug) || input.slug
    if (metaSlug !== input.slug) {
      return { error: "Este código não é válido para esta barbearia.", status: 403 }
    }
    resolvedIntent =
      meta.intent === "login"
        ? "login"
        : meta.intent === "reset_password"
          ? "reset_password"
          : meta.intent === "register"
            ? "register"
            : resolvedIntent
  }

  if (resolvedIntent !== input.expectedIntent) {
    return {
      error: "Este código foi pedido em outra etapa. Volte e peça um novo código.",
      status: 400,
    }
  }

  await prisma.clientOtpCode.deleteMany({
    where: { barbershopId: input.barbershopId, email },
  })

  return { ok: true, resolvedIntent, meta }
}
