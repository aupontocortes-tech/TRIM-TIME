import { randomInt } from "node:crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { findClientByPhoneDigits } from "@/lib/client-by-phone"
import { clientPhoneDigits } from "@/lib/client-phone-utils"
import { getClientPasswordHash, getActiveBarbershopBySlug } from "@/lib/public-booking"
import { sendClientOtpEmail } from "@/lib/send-client-otp-email"

export const dynamic = "force-dynamic"

const OTP_TTL_MS = 5 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const MAX_SENDS_WINDOW_MS = 10 * 60 * 1000
const MAX_SENDS_IN_WINDOW = 5

function normalizeEmail(s: string) {
  return s.trim().toLowerCase()
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function genCode() {
  return String(randomInt(0, 10000)).padStart(4, "0")
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
    const intent = body.intent === "login" ? "login" : "register"
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
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
        { status: 429 }
      )
    }

    const lastSend = await prisma.clientOtpCode.findFirst({
      where: { barbershopId: shop.id, email },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })
    if (lastSend && now.getTime() - lastSend.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil(
        (RESEND_COOLDOWN_MS - (now.getTime() - lastSend.createdAt.getTime())) / 1000
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
            { error: "Esta conta usa senha. Use «Conta antiga com senha» em Entrar." },
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
          { error: "Este telefone já está em uso por outro e-mail. Use o e-mail cadastrado ou fale com a barbearia." },
          { status: 409 }
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
          { error: "Esta conta usa senha. Use «Conta antiga com senha» abaixo." },
          { status: 403 }
        )
      }
    }

    const code = genCode()
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS)

    const row = await prisma.clientOtpCode.create({
      data: {
        barbershopId: shop.id,
        email,
        code,
        expiresAt,
        intent,
        nome: intent === "register" ? nome : null,
        telefone: intent === "register" ? telefone : null,
      },
    })

    const sent = await sendClientOtpEmail({
      to: email,
      shopName: shop.name,
      code,
      expiresInMinutes: 5,
    })
    if (!sent.ok) {
      await prisma.clientOtpCode.delete({ where: { id: row.id } }).catch(() => {})
      return NextResponse.json({ error: sent.error }, { status: 500 })
    }

    return NextResponse.json({ ok: true, expires_in_seconds: Math.floor(OTP_TTL_MS / 1000) })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao enviar código" },
      { status: 500 }
    )
  }
}
