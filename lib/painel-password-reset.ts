import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth/password"
import { withBarbershopPasswordHash } from "@/lib/barbershop-auth-settings"
import { findBarbershopByLoginEmail } from "@/lib/barbershop-login"
import { sendSupabaseEmailOtp, verifyEmailOtpWithFallback } from "@/lib/supabase-auth-otp"
import { createAnonServerAuthClient } from "@/lib/supabase/server"
import { isPublicOtpLengthValid, normalizePublicOtpCode } from "@/lib/public-otp-code"
import {
  canonicalSignupEmail,
  isValidSignupEmail,
  normalizeSignupEmail,
} from "@/lib/signup-identity"

const OTP_TTL_MS = 10 * 60 * 1000
const OTP_RESEND_COOLDOWN_MS = 60 * 1000

type OtpSendModel = {
  count: (args: object) => Promise<number>
  findFirst: (args: object) => Promise<{ createdAt: Date } | null>
  create: (args: object) => Promise<unknown>
  deleteMany: (args: object) => Promise<unknown>
}

function otpModel(): OtpSendModel | null {
  const p = prisma as unknown as { painelSignupOtpSend?: OtpSendModel }
  return p.painelSignupOtpSend ?? null
}

const OTP_KEY_PREFIX = "reset:"

function otpStorageEmail(authEmail: string) {
  return `${OTP_KEY_PREFIX}${authEmail}`
}

export async function sendPainelPasswordResetOtp(
  rawEmail: string
): Promise<
  | { ok: true; expires_in_seconds: number; email_for_otp: string }
  | { error: string; status: number }
> {
  const otpSend = otpModel()
  if (!otpSend) {
    return {
      error: "Servidor desatualizado. Tente «Entrar com Google» ou contate o suporte.",
      status: 503,
    }
  }

  const authEmail = normalizeSignupEmail(rawEmail)
  if (!isValidSignupEmail(authEmail)) {
    return { error: "Informe um e-mail válido.", status: 400 }
  }

  const barbershop = await findBarbershopByLoginEmail(rawEmail)
  if (!barbershop) {
    return {
      error: "Não encontramos barbearia com este e-mail. Verifique ou cadastre-se.",
      status: 404,
    }
  }

  const storageKey = otpStorageEmail(authEmail)
  const now = new Date()

  const lastSend = await otpSend.findFirst({
    where: { email: storageKey },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  if (
    lastSend?.createdAt &&
    now.getTime() - lastSend.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS
  ) {
    const waitSec = Math.ceil(
      (OTP_RESEND_COOLDOWN_MS - (now.getTime() - lastSend.createdAt.getTime())) / 1000
    )
    return { error: `Aguarde ${waitSec}s antes de pedir um novo código.`, status: 429 }
  }

  const sent = await sendSupabaseEmailOtp(authEmail, {
    subject: "Redefinir senha — Trim Time",
    intro: "Use este código para definir uma nova senha da sua barbearia no Trim Time:",
  })
  if ("error" in sent) {
    return { error: sent.error, status: sent.status }
  }

  await otpSend.deleteMany({ where: { email: storageKey } })
  await otpSend.create({
    data: {
      email: storageKey,
      code: sent.otp,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    },
  })

  return {
    ok: true,
    expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
    email_for_otp: authEmail,
  }
}

export async function confirmPainelPasswordReset(
  rawEmail: string,
  rawCode: string,
  newPassword: string
): Promise<{ ok: true } | { error: string; status: number }> {
  const otpSend = otpModel()
  if (!otpSend) {
    return {
      error: "Servidor desatualizado. Tente «Entrar com Google».",
      status: 503,
    }
  }

  const authEmail = normalizeSignupEmail(rawEmail)
  const code = normalizePublicOtpCode(rawCode)
  if (!isValidSignupEmail(authEmail) || !isPublicOtpLengthValid(code.length)) {
    return { error: "E-mail ou código inválido.", status: 400 }
  }
  if (!newPassword || newPassword.length < 6) {
    return { error: "A nova senha deve ter pelo menos 6 caracteres.", status: 400 }
  }

  const barbershop = await findBarbershopByLoginEmail(rawEmail)
  if (!barbershop) {
    return { error: "Conta não encontrada.", status: 404 }
  }

  const storageKey = otpStorageEmail(authEmail)
  const row = await otpSend.findFirst({
    where: { email: storageKey, code },
    orderBy: { createdAt: "desc" },
  }) as { expiresAt: Date } | null

  let verified = false
  if (row && row.expiresAt.getTime() > Date.now()) {
    verified = true
  } else {
    const supabase = createAnonServerAuthClient()
    const { error } = await verifyEmailOtpWithFallback(supabase, {
      email: authEmail,
      token: code,
    })
    verified = !error
  }

  if (!verified) {
    return { error: "Código inválido ou expirado. Peça um novo código.", status: 400 }
  }

  await otpSend.deleteMany({ where: { email: storageKey } })

  const emailCanon = canonicalSignupEmail(authEmail)
  await prisma.barbershop.update({
    where: { id: barbershop.id },
    data: {
      email: emailCanon,
      settings: withBarbershopPasswordHash(barbershop.settings, hashPassword(newPassword)),
    },
  })

  return { ok: true }
}
