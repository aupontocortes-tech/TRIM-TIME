import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth/password"
import { buildClientNotes, parseClientNotes } from "@/lib/client-auth-notes"
import { verifyClientOtpAudit } from "@/lib/client-otp-verify-audit"
import { getActiveBarbershopBySlug, toPublicClientSession } from "@/lib/public-booking"
import { publicClientCookieName, signPublicClientSession } from "@/lib/public-client-session"
import { isPublicOtpLengthValid, normalizePublicOtpCode } from "@/lib/public-otp-code"

export const dynamic = "force-dynamic"

function normalizeEmail(s: string) {
  return s.trim().toLowerCase()
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const shop = await getActiveBarbershopBySlug(slug)
    if (!shop || shop.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      email?: string
      code?: string
      senha?: string
      confirmarSenha?: string
    }
    const email = normalizeEmail(String(body.email ?? ""))
    const token = normalizePublicOtpCode(String(body.code ?? ""))
    const senha = String(body.senha ?? "").trim()
    const confirmar = String(body.confirmarSenha ?? body.confirmar ?? "").trim()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400 })
    }
    if (!isPublicOtpLengthValid(token.length)) {
      return NextResponse.json({ error: "Informe o código de 6 dígitos do e-mail." }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 })
    }
    if (senha !== confirmar) {
      return NextResponse.json({ error: "As senhas não coincidem." }, { status: 400 })
    }

    const verified = await verifyClientOtpAudit({
      barbershopId: shop.id,
      slug,
      email,
      token,
      expectedIntent: "reset_password",
    })
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: verified.status })
    }

    const client = await prisma.client.findFirst({
      where: {
        barbershopId: shop.id,
        email: { equals: email, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        photoUrl: true,
        cpf: true,
        notes: true,
      },
    })
    if (!client) {
      return NextResponse.json({ error: "Cadastro não encontrado para este e-mail." }, { status: 404 })
    }

    const prev = parseClientNotes(client.notes)
    const updated = await prisma.client.update({
      where: { id: client.id },
      data: {
        notes: buildClientNotes(prev.visibleNotes, { passwordHash: hashPassword(senha) }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        photoUrl: true,
        cpf: true,
        notes: true,
      },
    })

    const cookieStore = await cookies()
    cookieStore.set(
      publicClientCookieName(slug),
      signPublicClientSession({ clientId: updated.id, slug }),
      {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      }
    )

    return NextResponse.json({ ok: true, client: toPublicClientSession(updated) })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao redefinir senha" },
      { status: 500 }
    )
  }
}
