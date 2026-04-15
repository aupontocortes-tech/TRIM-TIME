import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/auth/password"
import { getActiveBarbershopBySlug, getClientPasswordHash, toPublicClientSession } from "@/lib/public-booking"
import { publicClientCookieName, signPublicClientSession } from "@/lib/public-client-session"
import { clientPhoneDigits, findClientByPhoneDigits } from "@/lib/client-by-phone"

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
      emailOuTelefone?: string
      senha?: string
    }
    const emailOuTelefone = String(body.emailOuTelefone ?? "").trim()
    const senha = String(body.senha ?? "")
    if (!emailOuTelefone || !senha) {
      return NextResponse.json({ error: "E-mail/telefone e senha são obrigatórios" }, { status: 400 })
    }

    const emailLower = emailOuTelefone.toLowerCase()
    let candidate = await prisma.client.findFirst({
      where: { barbershopId: shop.id, email: emailLower },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        notes: true,
        photoUrl: true,
        cpf: true,
      },
    })
    if (!candidate) {
      candidate = await prisma.client.findFirst({
        where: { barbershopId: shop.id, phone: emailOuTelefone },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          notes: true,
          photoUrl: true,
          cpf: true,
        },
      })
    }
    if (!candidate && clientPhoneDigits(emailOuTelefone).length >= 10) {
      candidate = await findClientByPhoneDigits(shop.id, emailOuTelefone)
    }
    if (!candidate) {
      return NextResponse.json({ error: "Email/telefone ou senha incorretos" }, { status: 401 })
    }

    const hash = getClientPasswordHash(candidate.notes)
    if (!verifyPassword(senha, hash)) {
      return NextResponse.json({ error: "Email/telefone ou senha incorretos" }, { status: 401 })
    }

    const cookieStore = await cookies()
    cookieStore.set(
      publicClientCookieName(slug),
      signPublicClientSession({ clientId: candidate.id, slug }),
      {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      }
    )

    return NextResponse.json({ ok: true, client: toPublicClientSession(candidate) })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao entrar" },
      { status: 500 }
    )
  }
}
