import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { findBarberByPortalToken, isValidPortalToken } from "@/lib/barber-portal-resolve"
import { normalizeBarberPortalEmail } from "@/lib/barber-portal-otp"
import { clientPhonesMatch } from "@/lib/client-phone-utils"
import { createAnonServerAuthClient } from "@/lib/supabase/server"
import { normalizePublicOtpCode, isPublicOtpLengthValid } from "@/lib/public-otp-code"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import {
  barberPortalCookieName,
  signBarberPortalSession,
} from "@/lib/barber-portal-session"

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
      code?: string
      password?: string
      new_password?: string
    }
    const email = normalizeBarberPortalEmail(String(body.email ?? ""))
    const telefone = String(body.telefone ?? "").trim()
    const token = normalizePublicOtpCode(String(body.code ?? ""))

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400 })
    }
    if (!telefone) {
      return NextResponse.json({ error: "Informe o telefone" }, { status: 400 })
    }
    if (!isPublicOtpLengthValid(token.length)) {
      return NextResponse.json({ error: "Informe o código recebido por e-mail (6 dígitos ou mais)." }, { status: 400 })
    }

    const barberEmail = (barber.email ?? "").trim().toLowerCase()
    if (!barberEmail || barberEmail !== email) {
      return NextResponse.json({ error: "E-mail não confere com o cadastro." }, { status: 403 })
    }
    if (!clientPhonesMatch(telefone, barber.phone)) {
      return NextResponse.json({ error: "Telefone não confere com o cadastro." }, { status: 403 })
    }

    let supabase
    try {
      supabase = createAnonServerAuthClient()
    } catch {
      return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 })
    }

    const { data: authData, error: authErr } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    })

    if (authErr || !authData.user) {
      const raw = authErr?.message?.toLowerCase() ?? ""
      let error =
        "Código inválido ou expirado. Confira os dígitos ou peça um novo código."
      if (raw.includes("expired") || raw.includes("otp_expired")) {
        error = "Código expirado. Peça um novo código."
      }
      return NextResponse.json({ error }, { status: 401 })
    }

    const hasPw = !!barber.passwordHash
    const hasGoogle = !!barber.authUserId
    if (!hasPw) {
      if (hasGoogle) {
        return NextResponse.json(
          { error: "Sua conta usa Google. Toque em «Entrar com Google»." },
          { status: 400 }
        )
      }
      const np = String(body.new_password ?? "").trim()
      if (np.length < 6) {
        return NextResponse.json(
          { error: "Defina uma senha com pelo menos 6 caracteres (primeiro acesso)." },
          { status: 400 }
        )
      }
      const hashed = hashPassword(np)
      await prisma.barber.update({
        where: { id: barber.id },
        data: { passwordHash: hashed },
      })
    } else {
      const pw = String(body.password ?? "")
      if (!verifyPassword(pw, barber.passwordHash)) {
        return NextResponse.json({ error: "Senha incorreta." }, { status: 403 })
      }
    }

    const cookieVal = signBarberPortalSession({
      barberId: barber.id,
      barbershopId: barber.barbershopId,
      portalToken,
    })
    const cookieStore = await cookies()
    cookieStore.set(barberPortalCookieName(), cookieVal, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    return NextResponse.json({
      ok: true,
      barber: { name: barber.name },
      barbershop: { name: barber.barbershop.name },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao validar" },
      { status: 500 }
    )
  }
}
