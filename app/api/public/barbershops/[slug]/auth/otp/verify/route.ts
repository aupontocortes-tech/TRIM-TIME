import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { findClientByPhoneDigits } from "@/lib/client-by-phone"
import { clientPhoneDigits } from "@/lib/client-phone-utils"
import { buildClientNotes, parseClientNotes } from "@/lib/client-auth-notes"
import { getClientPasswordHash, getActiveBarbershopBySlug, toPublicClientSession } from "@/lib/public-booking"
import { publicClientCookieName, signPublicClientSession } from "@/lib/public-client-session"

export const dynamic = "force-dynamic"

function normalizeEmail(s: string) {
  return s.trim().toLowerCase()
}

function codesEqual(a: string, b: string) {
  const x = Buffer.from(a.padStart(4, "0"), "utf8")
  const y = Buffer.from(b.padStart(4, "0"), "utf8")
  if (x.length !== y.length) return false
  return timingSafeEqual(x, y)
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
    const codeRaw = String(body.code ?? "").replace(/\D/g, "").slice(0, 4)

    if (!email || codeRaw.length !== 4) {
      return NextResponse.json({ error: "E-mail e código de 4 dígitos são obrigatórios" }, { status: 400 })
    }

    const row = await prisma.clientOtpCode.findFirst({
      where: {
        barbershopId: shop.id,
        email,
        intent,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!row || !codesEqual(row.code, codeRaw)) {
      return NextResponse.json({ error: "Código inválido ou expirado" }, { status: 401 })
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

    const nome = String(row.nome ?? "").trim()
    const telefone = String(row.telefone ?? "").trim()
    if (!nome || !telefone) {
      return NextResponse.json({ error: "Dados do cadastro incompletos. Solicite um novo código." }, { status: 400 })
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
