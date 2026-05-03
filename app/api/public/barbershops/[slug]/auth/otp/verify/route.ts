import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { findClientByPhoneDigits } from "@/lib/client-by-phone"
import { clientPhoneDigits } from "@/lib/client-phone-utils"
import { buildClientNotes, parseClientNotes } from "@/lib/client-auth-notes"
import { getClientPasswordHash, getActiveBarbershopBySlug, toPublicClientSession } from "@/lib/public-booking"
import { publicClientCookieName, signPublicClientSession } from "@/lib/public-client-session"
import { createAnonServerAuthClient } from "@/lib/supabase/server"
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
            "Informe o e-mail e o código completo como no e-mail (em geral 6 a 8 caracteres: números e, se aparecer, letras maiúsculas).",
        },
        { status: 400 }
      )
    }

    let supabase
    try {
      supabase = createAnonServerAuthClient()
    } catch {
      return NextResponse.json({ error: "Supabase não configurado (URL e ANON_KEY)." }, { status: 500 })
    }

    const { data: authData, error: authErr } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    })

    if (authErr || !authData.user) {
      const raw = authErr?.message?.toLowerCase() ?? ""
      let error =
        "Código inválido ou expirado. Confira letras e números exatamente como no e-mail, peça um novo código ou use outro navegador (antivírus às vezes consome o link)."
      if (raw.includes("expired") || raw.includes("otp_expired")) {
        error = "Código expirado. Peça um novo em «Receber código»."
      }
      return NextResponse.json(
        {
          error,
          ...(process.env.NODE_ENV === "development" && authErr?.message
            ? { debug: authErr.message }
            : {}),
        },
        { status: 401 }
      )
    }

    const user = authData.user
    const userEmail = user.email ? normalizeEmail(user.email) : ""
    if (!userEmail || userEmail !== email) {
      return NextResponse.json({ error: "E-mail não confere com o código." }, { status: 400 })
    }

    const meta = (user.user_metadata || {}) as Record<string, unknown>
    const metaSlug = asStr(meta.barbershop_slug)
    if (!metaSlug) {
      return NextResponse.json(
        {
          error:
            "Peça um novo código nesta mesma barbearia (dados da sessão incompletos). Se persistir, saia e entre de novo no link.",
        },
        { status: 400 }
      )
    }
    if (metaSlug !== slug) {
      return NextResponse.json({ error: "Este código não é válido para esta barbearia." }, { status: 403 })
    }
    const metaIntent = meta.intent === "login" ? "login" : "register"
    if (metaIntent !== intent) {
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
        where: { barbershopId: shop.id, email },
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

    const nome = asStr(meta.nome)
    const telefone = asStr(meta.telefone)
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
