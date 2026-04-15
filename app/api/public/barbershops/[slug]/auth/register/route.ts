import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth/password"
import { buildClientNotes, parseClientNotes } from "@/lib/client-auth-notes"
import { getActiveBarbershopBySlug, toPublicClientSession } from "@/lib/public-booking"
import { publicClientCookieName, signPublicClientSession } from "@/lib/public-client-session"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const shop = await getActiveBarbershopBySlug(slug)
    if (!shop || shop.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      nome?: string
      email?: string
      telefone?: string
      senha?: string
    }
    const nome = String(body.nome ?? "").trim()
    const email = String(body.email ?? "").trim().toLowerCase()
    const telefone = String(body.telefone ?? "").trim()
    const senha = String(body.senha ?? "")

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: "Nome, e-mail e senha são obrigatórios" }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 })
    }

    const normalizedPhone = telefone.replace(/\D/g, "")
    const existing = await prisma.client.findFirst({
      where: {
        barbershopId: shop.id,
        OR: [
          { email: email || undefined },
          ...(normalizedPhone ? [{ phone: telefone }] : []),
        ],
      },
      select: { id: true, name: true, email: true, phone: true, notes: true, photoUrl: true, cpf: true },
    })

    let client
    if (existing) {
      const auth = parseClientNotes(existing.notes).auth
      if (auth.passwordHash) {
        return NextResponse.json({ error: "Já existe uma conta com este e-mail/telefone" }, { status: 409 })
      }
      client = await prisma.client.update({
        where: { id: existing.id },
        data: {
          name: nome,
          email,
          phone: telefone || null,
          notes: buildClientNotes(parseClientNotes(existing.notes).visibleNotes, {
            passwordHash: hashPassword(senha),
          }),
        },
        select: { id: true, name: true, email: true, phone: true, photoUrl: true, cpf: true },
      })
    } else {
      client = await prisma.client.create({
        data: {
          barbershopId: shop.id,
          name: nome,
          email,
          phone: telefone || null,
          notes: buildClientNotes(null, { passwordHash: hashPassword(senha) }),
        },
        select: { id: true, name: true, email: true, phone: true, photoUrl: true, cpf: true },
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
      { error: e instanceof Error ? e.message : "Erro ao criar conta" },
      { status: 500 }
    )
  }
}
