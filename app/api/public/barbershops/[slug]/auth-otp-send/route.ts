import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { findClientByPhoneDigits } from "@/lib/client-by-phone"
import { clientPhoneDigits } from "@/lib/client-phone-utils"
import { getClientPasswordHash, getActiveBarbershopBySlug } from "@/lib/public-booking"
import { sendClientBookingEmailOtp } from "@/lib/client-booking-otp"
import { createAnonServerAuthClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/** Código real em `client_otp_codes` + entrega via Resend (se configurado) ou Supabase Auth. */

/** Alinhado ao e-mail no Supabase (ex.: “expira em 10 minutos”). Só afeta linha de auditoria/rate limit local. */
const OTP_TTL_MS = 10 * 60 * 1000

function envInt(name: string, fallback: number) {
  const v = process.env[name]?.trim()
  if (!v) return fallback
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Entre um envio e outro. O Supabase costuma impor ~60s entre e-mails OTP; se for menor aqui,
 * o usuário recebe erro genérico do Auth. Padrão 60s — reduza só se aumentar Rate limits no painel.
 * Override: OTP_RESEND_COOLDOWN_SECONDS
 */
const OTP_RESEND_COOLDOWN_MS = envInt("OTP_RESEND_COOLDOWN_SECONDS", 60) * 1000
/** Janela para contar envios. Padrão 60 min. Override: OTP_SEND_WINDOW_MINUTES */
const MAX_SENDS_WINDOW_MS = envInt("OTP_SEND_WINDOW_MINUTES", 60) * 60 * 1000
/** Máx. envios por e-mail+barbearia na janela acima. Padrão 50. Override: OTP_MAX_SENDS_PER_WINDOW */
const MAX_SENDS_IN_WINDOW = envInt("OTP_MAX_SENDS_PER_WINDOW", 50)

function normalizeEmail(s: string) {
  return s.trim().toLowerCase()
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

/** Erros do GoTrue/Supabase que indicam “espere antes de pedir de novo” (não apagamos o registro de auditoria). */
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

function friendlyOtpSendError(message: string | undefined): string {
  if (isSupabaseOtpThrottleMessage(message)) {
    const sec = Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000)
    return `Muitas solicitações de código. Aguarde cerca de ${sec} segundos entre um envio e outro. Se precisar de mais envios por hora, aumente em Supabase → Authentication → Rate limits.`
  }
  return (message ?? "").trim() || "Não foi possível enviar o código por e-mail."
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const shop = await getActiveBarbershopBySlug(slug)
    if (!shop || shop.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      intent?: string
      email?: string
      nome?: string
      telefone?: string
    }
    const intent =
      body.intent === "login"
        ? "login"
        : body.intent === "reset_password"
          ? "reset_password"
          : "register"
    const email = normalizeEmail(String(body.email ?? ""))
    const nome = String(body.nome ?? "").trim()
    const telefone = String(body.telefone ?? "").trim()

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400 })
    }

    const now = new Date()
    const windowStart = new Date(now.getTime() - MAX_SENDS_WINDOW_MS)

    const sendsInWindow = await prisma.clientOtpCode.count({
      where: {
        barbershopId: shop.id,
        email,
        createdAt: { gte: windowStart },
      },
    })
    if (sendsInWindow >= MAX_SENDS_IN_WINDOW) {
      const winMin = Math.round(MAX_SENDS_WINDOW_MS / 60000)
      return NextResponse.json(
        {
          error: `Muitos envios de código para este e-mail. Aguarde até ${winMin} minutos ou tente mais tarde.`,
        },
        { status: 429 }
      )
    }

    const lastSend = await prisma.clientOtpCode.findFirst({
      where: { barbershopId: shop.id, email },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })
    if (lastSend && now.getTime() - lastSend.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - (now.getTime() - lastSend.createdAt.getTime())) / 1000
      )
      return NextResponse.json(
        { error: `Aguarde ${waitSec}s para reenviar o código.` },
        { status: 429 }
      )
    }

    if (intent === "register") {
      if (!nome || !telefone) {
        return NextResponse.json({ error: "Nome, telefone e e-mail são obrigatórios" }, { status: 400 })
      }
      const digits = clientPhoneDigits(telefone)
      if (digits.length < 10) {
        return NextResponse.json({ error: "Informe um telefone válido com DDD" }, { status: 400 })
      }

      const byEmail = await prisma.client.findFirst({
        where: { barbershopId: shop.id, email },
        select: { id: true, notes: true },
      })
      if (byEmail) {
        if (getClientPasswordHash(byEmail.notes)) {
          return NextResponse.json(
            { error: "Esta conta usa senha. Em Entrar, use e-mail e senha (não o código)." },
            { status: 409 }
          )
        }
        return NextResponse.json(
          { error: "Já existe cadastro com este e-mail. Use «Entrar» e o código no e-mail." },
          { status: 409 }
        )
      }

      const byPhone = await findClientByPhoneDigits(shop.id, telefone)
      if (byPhone?.email && normalizeEmail(byPhone.email) !== email) {
        return NextResponse.json(
          {
            error:
              "Este telefone já está em uso por outro e-mail. Use o e-mail cadastrado ou fale com a barbearia.",
          },
          { status: 409 }
        )
      }
    } else if (intent === "reset_password") {
      const client = await prisma.client.findFirst({
        where: {
          barbershopId: shop.id,
          email: { equals: email, mode: "insensitive" },
        },
        select: { id: true },
      })
      if (!client) {
        return NextResponse.json(
          { error: "Não encontramos cadastro com este e-mail nesta barbearia." },
          { status: 404 }
        )
      }
    } else {
      const client = await prisma.client.findFirst({
        where: { barbershopId: shop.id, email },
        select: { id: true, notes: true },
      })
      if (!client) {
        return NextResponse.json({ error: "Não encontramos cadastro com este e-mail." }, { status: 404 })
      }
      if (getClientPasswordHash(client.notes)) {
        return NextResponse.json(
          { error: "Esta conta usa senha. Em Entrar, use e-mail e senha (não o código)." },
          { status: 403 }
        )
      }
    }

    const expiresAt = new Date(now.getTime() + OTP_TTL_MS)

    const sent = await sendClientBookingEmailOtp(email, shop.name, intent)
    if ("error" in sent) {
      let supabase
      try {
        supabase = createAnonServerAuthClient()
      } catch {
        return NextResponse.json(
          {
            error:
              sent.error ||
              "Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY).",
          },
          { status: sent.status >= 500 ? 500 : sent.status }
        )
      }

      const metadata: Record<string, string> = {
        intent,
        barbershop_slug: slug,
      }
      if (intent === "register") {
        metadata.nome = nome
        metadata.telefone = telefone
      }

      const { error: authErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: intent === "register",
          data: metadata,
        },
      })

      if (authErr) {
        const throttled = isSupabaseOtpThrottleMessage(authErr.message)
        return NextResponse.json(
          { error: friendlyOtpSendError(authErr.message) },
          { status: throttled ? 429 : 400 }
        )
      }

      await prisma.clientOtpCode.create({
        data: {
          barbershopId: shop.id,
          email,
          code: "****",
          expiresAt,
          intent,
          nome: intent === "register" ? nome : null,
          telefone: intent === "register" ? telefone : null,
        },
      })

      return NextResponse.json({ ok: true, expires_in_seconds: Math.floor(OTP_TTL_MS / 1000) })
    }

    await prisma.clientOtpCode.create({
      data: {
        barbershopId: shop.id,
        email,
        /** Auditoria/rate limit; validação do código via Supabase Auth (OTP tem 6+ dígitos). */
        code: "****",
        expiresAt,
        intent,
        nome: intent === "register" ? nome : null,
        telefone: intent === "register" ? telefone : null,
      },
    })

    return NextResponse.json({ ok: true, expires_in_seconds: Math.floor(OTP_TTL_MS / 1000) })
  } catch (e) {
    const raw = e instanceof Error ? e.message : ""
    const friendly =
      raw.includes("too long for the column") || raw.includes("clientOtpCode.create")
        ? "Erro ao registrar o envio do código. Tente de novo em instantes ou use «Entrar com Google»."
        : raw || "Erro ao enviar código"
    console.error("[client otp send]", e)
    return NextResponse.json({ error: friendly }, { status: 500 })
  }
}
