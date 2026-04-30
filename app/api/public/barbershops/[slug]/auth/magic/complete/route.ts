import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getActiveBarbershopBySlug, toPublicClientSession } from "@/lib/public-booking"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { publicClientCookieName, signPublicClientSession } from "@/lib/public-client-session"
import { clientPhoneDigits, findClientByPhoneDigits } from "@/lib/client-by-phone"

type Body = {
  mode?: "register" | "login"
  nome?: string
  telefone?: string
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

    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization")
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
    const body = (await request.json().catch(() => ({}))) as Body
    const mode: "register" | "login" = body.mode === "register" ? "register" : "login"
    if (!bearer) {
      return NextResponse.json({ error: "Token de autenticação ausente" }, { status: 401 })
    }

    const supabase = createServiceRoleClient()
    const userResp = await supabase.auth.getUser(bearer)
    const user = userResp.data.user
    if (!user?.email) {
      return NextResponse.json({ error: "Sessão Supabase inválida" }, { status: 401 })
    }

    const email = user.email.trim().toLowerCase()
    const nomeMeta = asStr(user.user_metadata?.nome)
    const telefoneMeta = asStr(user.user_metadata?.telefone)
    const nomeBody = asStr(body.nome)
    const telefoneBody = asStr(body.telefone)
    const nome = nomeBody || nomeMeta
    const telefone = telefoneBody || telefoneMeta

    let client = await prisma.client.findFirst({
      where: { barbershopId: shop.id, email },
      select: { id: true, name: true, email: true, phone: true, photoUrl: true, cpf: true, notes: true },
    })

    if (!client && mode === "login") {
      return NextResponse.json({ error: "Este e-mail ainda não está cadastrado nesta barbearia." }, { status: 404 })
    }

    if (mode === "register") {
      if (!nome || !telefone) {
        return NextResponse.json(
          { error: "Dados incompletos. Solicite um novo link pelo cadastro." },
          { status: 400 }
        )
      }
      const digits = clientPhoneDigits(telefone)
      if (digits.length < 10) {
        return NextResponse.json({ error: "Telefone inválido no cadastro." }, { status: 400 })
      }

      const byPhone = await findClientByPhoneDigits(shop.id, telefone)
      if (byPhone && byPhone.email && byPhone.email.trim().toLowerCase() !== email) {
        return NextResponse.json(
          { error: "Este telefone já está vinculado a outro e-mail." },
          { status: 409 }
        )
      }

      if (client) {
        client = await prisma.client.update({
          where: { id: client.id },
          data: {
            name: nome,
            phone: telefone,
            email,
          },
          select: { id: true, name: true, email: true, phone: true, photoUrl: true, cpf: true, notes: true },
        })
      } else if (byPhone) {
        client = await prisma.client.update({
          where: { id: byPhone.id },
          data: {
            name: nome,
            phone: telefone,
            email,
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
          },
          select: { id: true, name: true, email: true, phone: true, photoUrl: true, cpf: true, notes: true },
        })
      }
    }

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 })
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
      { error: e instanceof Error ? e.message : "Erro ao concluir autenticação" },
      { status: 500 }
    )
  }
}
