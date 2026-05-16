import crypto from "node:crypto"
import { prisma } from "@/lib/prisma"
import { conflictForBarbershopSignup } from "@/lib/barbershop-signup-conflicts"
import { createAnonServerAuthClient, createServiceRoleClient } from "@/lib/supabase/server"
import { sendSupabaseEmailOtp, verifyEmailOtpWithFallback } from "@/lib/supabase-auth-otp"
import { isPublicOtpLengthValid, normalizePublicOtpCode } from "@/lib/public-otp-code"
import {
  canonicalSignupEmail,
  normalizeSignupEmail,
  isValidSignupEmail,
  emailsEquivalentForSignup,
} from "@/lib/signup-identity"

/** Re-export para APIs que já importavam daqui */
export { normalizeSignupEmail, isValidSignupEmail, canonicalSignupEmail } from "@/lib/signup-identity"

/** Metadados do usuário Supabase OTP — precisa conferir na verificação. */
export const PAINEL_SIGNUP_OTP_METADATA_INTENT = "painel_signup"

const OTP_TTL_MS = 10 * 60 * 1000

const TOKEN_TTL_MS = 45 * 60 * 1000

/** Prisma sem `generate` ou schema antigo → delegados `undefined` e `.count` quebra em runtime. */
function painelSignupPrismaOrNull() {
  type OtpSend = {
    count: (args: object) => Promise<number>
    findFirst: (args: object) => Promise<{ id: string; code: string; expiresAt: Date; createdAt?: Date } | null>
    create: (args: object) => Promise<{ id: string }>
    delete: (args: object) => Promise<unknown>
    deleteMany: (args: object) => Promise<unknown>
  }
  type SignupTok = {
    create: (args: object) => Promise<unknown>
    updateMany: (args: object) => Promise<unknown>
    findUnique: (args: object) => Promise<unknown>
    update: (args: object) => Promise<unknown>
  }
  const p = prisma as unknown as { painelSignupOtpSend?: OtpSend; painelSignupToken?: SignupTok }
  const otpSend = p.painelSignupOtpSend
  const signupToken = p.painelSignupToken
  if (!otpSend || !signupToken) {
    console.error(
      "[painel-signup] Modelos Prisma ausentes (painelSignupOtpSend / painelSignupToken). " +
        "Rode `npx prisma generate` e `npx prisma db push` no projeto e faça deploy de novo."
    )
    return null
  }
  return { otpSend, signupToken }
}

const PRISMA_UPGRADE_MSG =
  "Cadastro indisponível: o servidor precisa ser atualizado (Prisma + banco). Rode `npx prisma generate`, `npx prisma db push` e publique de novo."

function envInt(name: string, fallback: number) {
  const v = process.env[name]?.trim()
  if (!v) return fallback
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const OTP_RESEND_COOLDOWN_MS = envInt("OTP_RESEND_COOLDOWN_SECONDS", 60) * 1000
const MAX_SENDS_WINDOW_MS = envInt("OTP_SEND_WINDOW_MINUTES", 60) * 60 * 1000
const MAX_SENDS_IN_WINDOW = envInt("OTP_MAX_SENDS_PER_WINDOW", 50)

/**
 * @param rawEmail texto digitado pelo usuário
 * @param opts.phone — bloqueia se já existir barbearia com o mesmo número (BR normalizado).
 */
export async function sendPainelSignupOtp(
  rawEmail: string,
  opts?: { phone?: string | null }
): Promise<
  | { ok: true; expires_in_seconds: number; email_canonical: string; email_for_otp: string }
  | { error: string; status: number }
> {
  const models = painelSignupPrismaOrNull()
  if (!models) {
    return { error: PRISMA_UPGRADE_MSG, status: 503 }
  }
  const { otpSend } = models

  const authEmail = normalizeSignupEmail(rawEmail)
  const emailCanon = canonicalSignupEmail(authEmail)
  const now = new Date()
  const windowStart = new Date(now.getTime() - MAX_SENDS_WINDOW_MS)

  const sendsInWindow = await otpSend.count({
    where: { email: authEmail, createdAt: { gte: windowStart } },
  })
  if (sendsInWindow >= MAX_SENDS_IN_WINDOW) {
    return { error: "Limite de envios deste código para este e-mail. Tente mais tarde.", status: 429 }
  }

  const lastSend = await otpSend.findFirst({
    where: { email: authEmail },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  if (lastSend && now.getTime() - lastSend.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil(
      (OTP_RESEND_COOLDOWN_MS - (now.getTime() - lastSend.createdAt.getTime())) / 1000
    )
    return {
      error: `Aguarde ${waitSec}s antes de pedir um novo código.`,
      status: 429,
    }
  }

  const conflict = await conflictForBarbershopSignup(prisma, {
    email: emailCanon,
    phone: opts?.phone ?? null,
  })
  if (conflict === "email") {
    return {
      error: "Já existe uma conta cadastrada com este e-mail (ou um Gmail equivalente).",
      status: 409,
    }
  }
  if (conflict === "phone") {
    return { error: "Já existe uma conta cadastrada com este telefone.", status: 409 }
  }

  const sent = await sendSupabaseEmailOtp(authEmail)
  if ("error" in sent) {
    return { error: sent.error, status: sent.status }
  }

  const expiresAt = new Date(now.getTime() + OTP_TTL_MS)
  await otpSend.create({
    data: {
      email: authEmail,
      code: sent.otp,
      expiresAt,
    },
  })

  return {
    ok: true,
    expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
    email_canonical: emailCanon,
    email_for_otp: authEmail,
  }
}

export async function verifyPainelSignupOtp(
  rawEmail: string,
  rawCode: string
): Promise<
  | { ok: true; signup_token: string; expires_at: string; email_canonical: string }
  | { error: string; status: number }
> {
  const models = painelSignupPrismaOrNull()
  if (!models) {
    return { error: PRISMA_UPGRADE_MSG, status: 503 }
  }
  const { otpSend, signupToken } = models

  const authEmail = normalizeSignupEmail(rawEmail)
  const emailCanon = canonicalSignupEmail(authEmail)
  const token = normalizePublicOtpCode(String(rawCode ?? ""))
  if (!isPublicOtpLengthValid(token.length)) {
    return {
      error:
        "Informe o código como no e-mail (em geral 6 dígitos; até 10 caracteres em projetos com OTP longo).",
      status: 400,
    }
  }

  const audit = await otpSend.findFirst({
    where: { email: authEmail },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, expiresAt: true },
  })
  if (!audit) {
    return {
      error:
        "Não há envio registrado para este e-mail neste fluxo. Comece pelo passo anterior.",
      status: 400,
    }
  }

  const storedCode = normalizePublicOtpCode(audit.code)
  const codeOk =
    isPublicOtpLengthValid(storedCode.length) &&
    storedCode === token &&
    audit.expiresAt.getTime() > Date.now()

  if (!codeOk) {
    let supabase
    try {
      supabase = createAnonServerAuthClient()
    } catch {
      return { error: "Supabase não configurado.", status: 500 }
    }

    const { data: authData, error: authErr } = await verifyEmailOtpWithFallback(supabase, {
      email: authEmail,
      token,
    })

    if (authErr || !authData?.user) {
      const raw = authErr?.message?.toLowerCase() ?? ""
      let error =
        "Código inválido ou expirado. Confira os dígitos ou peça um novo código."
      if (raw.includes("expired") || raw.includes("otp_expired")) {
        error = "Código expirado. Peça um novo em «Enviar de novo»."
      }
      return { error, status: 401 }
    }

    const user = authData.user
    if (!user.email || !emailsEquivalentForSignup(user.email, emailCanon)) {
      return { error: "E-mail não confere com o código.", status: 400 }
    }

    try {
      const admin = createServiceRoleClient()
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata as Record<string, unknown>),
          intent: PAINEL_SIGNUP_OTP_METADATA_INTENT,
        },
      })
    } catch (e) {
      console.warn("[painel-signup] metadata intent após OTP", e)
    }
  }

  await otpSend.deleteMany({ where: { email: authEmail } })

  const opaque = crypto.randomBytes(32).toString("hex")
  const exp = new Date(Date.now() + TOKEN_TTL_MS)

  await signupToken.updateMany({
    where: { email: emailCanon, usedAt: null },
    data: { usedAt: new Date() },
  })

  await signupToken.create({
    data: {
      email: emailCanon,
      token: opaque,
      expiresAt: exp,
    },
  })

  return {
    ok: true,
    signup_token: opaque,
    expires_at: exp.toISOString(),
    email_canonical: emailCanon,
  }
}
