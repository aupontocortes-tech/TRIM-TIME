import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { findBarberByPortalToken, isValidPortalToken } from "@/lib/barber-portal-resolve"
import {
  BARBER_OTP_AUDIT_PLACEHOLDER,
  BARBER_OTP_MAX_SENDS_IN_WINDOW,
  BARBER_OTP_MAX_SENDS_WINDOW_MS,
  BARBER_OTP_RESEND_COOLDOWN_MS,
  barberOtpExpiresAt,
  friendlyBarberOtpSendError,
  normalizeBarberPortalEmail,
} from "@/lib/barber-portal-otp"
import { clientPhonesMatch } from "@/lib/client-phone-utils"
import { createAnonServerAuthClient } from "@/lib/supabase/server"

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params
    if (!isValidPortalToken(portalToken)) {
      return NextResponse.json({ error: "Link inválido" }, { status: 400 })
    }

    const barber = await findBarberByPortalToken(portalToken)
    if (!barber || barber.barbershop.suspendedAt) {
      return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      email?: string
      telefone?: string
    }
    const email = normalizeBarberPortalEmail(String(body.email ?? ""))
    const telefone = String(body.telefone ?? "").trim()

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400 })
    }
    if (!telefone) {
      return NextResponse.json({ error: "Informe o telefone cadastrado" }, { status: 400 })
    }

    const barberEmail = (barber.email ?? "").trim().toLowerCase()
    if (!barberEmail || barberEmail !== email) {
      return NextResponse.json({ error: "E-mail não confere com o cadastro deste link." }, { status: 403 })
    }
    if (!clientPhonesMatch(telefone, barber.phone)) {
      return NextResponse.json({ error: "Telefone não confere com o cadastro." }, { status: 403 })
    }

    const now = new Date()
    const windowStart = new Date(now.getTime() - BARBER_OTP_MAX_SENDS_WINDOW_MS)

    const sendsInWindow = await prisma.barberOtpCode.count({
      where: {
        barbershopId: barber.barbershopId,
        email,
        createdAt: { gte: windowStart },
      },
    })
    if (sendsInWindow >= BARBER_OTP_MAX_SENDS_IN_WINDOW) {
      const winMin = Math.round(BARBER_OTP_MAX_SENDS_WINDOW_MS / 60000)
      return NextResponse.json(
        { error: `Muitos envios para este e-mail. Aguarde até ${winMin} minutos.` },
        { status: 429 }
      )
    }

    const lastSend = await prisma.barberOtpCode.findFirst({
      where: { barbershopId: barber.barbershopId, email },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })
    if (lastSend && now.getTime() - lastSend.createdAt.getTime() < BARBER_OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil(
        (BARBER_OTP_RESEND_COOLDOWN_MS - (now.getTime() - lastSend.createdAt.getTime())) / 1000
      )
      return NextResponse.json(
        { error: `Aguarde ${Math.max(1, waitSec)} segundos para pedir outro código.` },
        { status: 429 }
      )
    }

    const expiresAt = barberOtpExpiresAt()
    const audit = await prisma.barberOtpCode.create({
      data: {
        barbershopId: barber.barbershopId,
        email,
        code: BARBER_OTP_AUDIT_PLACEHOLDER,
        expiresAt,
        intent: "barber_portal",
      },
    })

    let supabase
    try {
      supabase = createAnonServerAuthClient()
    } catch {
      await prisma.barberOtpCode.delete({ where: { id: audit.id } }).catch(() => {})
      return NextResponse.json(
        { error: "Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL e ANON_KEY)." },
        { status: 500 }
      )
    }

    const { error: authErr } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Permite receber OTP mesmo se o e-mail ainda não existir no Auth (primeiro acesso).
        shouldCreateUser: true,
        data: {
          intent: "barber_portal",
          barbershop_id: barber.barbershopId,
          barber_id: barber.id,
        },
      },
    })

    if (authErr) {
      await prisma.barberOtpCode.delete({ where: { id: audit.id } }).catch(() => {})
      return NextResponse.json({ error: friendlyBarberOtpSendError(authErr.message) }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao enviar código" },
      { status: 500 }
    )
  }
}
