import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { findClientByPhoneDigits } from "@/lib/client-by-phone"
import { clientPhoneDigits } from "@/lib/client-phone-utils"
import { buildClientNotes, parseClientNotes } from "@/lib/client-auth-notes"
import { getClientPasswordHash, getActiveBarbershopBySlug, toPublicClientSession } from "@/lib/public-booking"
import { publicClientCookieName, signPublicClientSession } from "@/lib/public-client-session"
import {
  clientOtpCodeMatches,
  verifyClientBookingOtpWithSupabase,
} from "@/lib/client-booking-otp"
import { isPublicOtpLengthValid, normalizePublicOtpCode } from "@/lib/public-otp-code"

export const dynamic = "force-dynamic"

function normalizeEmail(s: string) {
  return s.trim().toLowerCase()
}

function asStr(v: unknown) {
  return typeof v === "string" ? v.trim() : ""
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
      code?: string
    }
    const intent = body.intent === "login" ? "login" : "register"
    const email = normalizeEmail(String(body.email ?? ""))
    const token = normalizePublicOtpCode(String(body.code ?? ""))

    if (!email || !isPublicOtpLengthValid(token.length)) {
      return NextResponse.json(
        {
          error:
            "Informe o e-mail e o código como no e-mail (em geral 6 dígitos; em projetos com OTP longo ou alfanumérico, até 10 caracteres).",
        },
        { status: 400 }
      )
    }

    const audit = await prisma.clientOtpCode.findFirst({
      where: { barbershopId: shop.id, email },
      orderBy: { createdAt: "desc" },
      select: { id: true, code: true, expiresAt: true, intent: true, nome: true, telefone: true },
    })

    if (!audit) {
      return NextResponse.json(
        {
          error:
            "Não há envio registrado para este e-mail. Peça um novo código nesta barbearia.",
        },
        { status: 400 }
      )
    }

    const dbCodeOk =
      clientOtpCodeMatches(audit.code, token) && audit.expiresAt.getTime() > Date.now()

    let meta: Record<string, unknown> = {}
    let resolvedIntent: "login" | "register" =
      audit.intent === "login" ? "login" : "register"

    if (!dbCodeOk) {
      const supa = await verifyClientBookingOtpWithSupabase(email, token)
      if ("error" in supa) {
        return NextResponse.json({ error: supa.error }, { status: 401 })
      }
      const user = supa.user
      const userEmail = user.email ? normalizeEmail(user.email) : ""
      if (!userEmail || userEmail !== email) {
        return NextResponse.json({ error: "E-mail não confere com o código." }, { status: 400 })
      }
      meta = (user.user_metadata || {}) as Record<string, unknown>
      const metaSlugFromUser = asStr(meta.barbershop_slug)
      const metaSlug = metaSlugFromUser || slug
      if (metaSlug !== slug) {
        return NextResponse.json({ error: "Este código não é válido para esta barbearia." }, { status: 403 })
      }
      resolvedIntent =
        meta.intent === "login"
          ? "login"
          : meta.intent === "register"
            ? "register"
            : resolvedIntent
    }

    if (resolvedIntent !== intent) {
      return NextResponse.json(
        { error: "Use a mesma tela (cadastro ou entrar) em que pediu o código." },
        { status: 400 }
      )
    }

    await prisma.clientOtpCode.deleteMany({
      where: { barbershopId: shop.id, email },
    })

    if (intent === "login") {
      const client = await prisma.client.findFirst({
        where: {
          barbershopId: shop.id,
          email: { equals: email, mode: "insensitive" },
        },
        select: { id: true, name: true, email: true, phone: true, photoUrl: true, cpf: true, notes: true },
      })
      if (!client) {
        return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
      }
      if (getClientPasswordHash(client.notes)) {
        return NextResponse.json({ error: "Esta conta usa senha." }, { status: 403 })
      }

      const cookieStore = await cookies()
      cookieStore.set(publicClientCookieName(slug), signPublicClientSession({ clientId: client.id, slug }), {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      })
      return NextResponse.json({ ok: true, client: toPublicClientSession(client) })
    }

    const nome = asStr(meta.nome) || (audit.nome?.trim() ?? "")
    const telefone = asStr(meta.telefone) || (audit.telefone?.trim() ?? "")
    if (!nome || !telefone) {
      return NextResponse.json(
        { error: "Dados do cadastro incompletos. Volte ao cadastro e peça um novo código." },
        { status: 400 }
      )
    }
    const digits = clientPhoneDigits(telefone)
    if (digits.length < 10) {
      return NextResponse.json({ error: "Telefone inválido no cadastro" }, { status: 400 })
    }

    const byPhone = await findClientByPhoneDigits(shop.id, telefone)
    if (byPhone) {
      const em = byPhone.email ? normalizeEmail(byPhone.email) : ""
      if (em && em !== email) {
        return NextResponse.json(
          { error: "Este telefone já está vinculado a outro e-mail." },
          { status: 409 }
        )
      }
    }

    let client = await prisma.client.findFirst({
      where: { barbershopId: shop.id, email },
      select: { id: true, name: true, email: true, phone: true, photoUrl: true, cpf: true, notes: true },
    })

    if (client) {
      if (getClientPasswordHash(client.notes)) {
        return NextResponse.json({ error: "Esta conta usa senha." }, { status: 403 })
      }
      const prev = parseClientNotes(client.notes)
      client = await prisma.client.update({
        where: { id: client.id },
        data: {
          name: nome,
          phone: telefone,
          email,
          notes: buildClientNotes(prev.visibleNotes, {}),
        },
        select: { id: true, name: true, email: true, phone: true, photoUrl: true, cpf: true, notes: true },
      })
    } else if (byPhone) {
      const prev = parseClientNotes(byPhone.notes)
      client = await prisma.client.update({
        where: { id: byPhone.id },
        data: {
          name: nome,
          phone: telefone,
          email,
          notes: buildClientNotes(prev.visibleNotes, {}),
        },
        select: { id: true, name: true, email: true, phone: true, photoUrl: true, cpf: true, notes: true },
      })
    } else {
      client = await prisma.client.create({
        data: {
          barbershopId: shop.id,
          name: nome,
          email,
          phone: telefone,
          notes: null,
        },
        select: { id: true, name: true, email: true, phone: true, photoUrl: true, cpf: true, notes: true },
      })
    }

    const cookieStore = await cookies()
    cookieStore.set(publicClientCookieName(slug), signPublicClientSession({ clientId: client.id, slug }), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    return NextResponse.json({ ok: true, client: toPublicClientSession(client) })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao validar código" },
      { status: 500 }
    )
  }
}
