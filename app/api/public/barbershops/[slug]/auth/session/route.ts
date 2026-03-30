import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getActiveBarbershopBySlug, toPublicClientSession } from "@/lib/public-booking"
import { publicClientCookieName, verifyPublicClientSession } from "@/lib/public-client-session"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const shop = await getActiveBarbershopBySlug(slug)
    if (!shop || shop.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    const cookieStore = await cookies()
    const raw = cookieStore.get(publicClientCookieName(slug))?.value
    const session = verifyPublicClientSession(slug, raw)
    if (!session) {
      return NextResponse.json({ client: null }, { status: 200 })
    }

    const client = await prisma.client.findFirst({
      where: { id: session.clientId, barbershopId: shop.id },
      select: { id: true, name: true, email: true, phone: true, photoUrl: true },
    })
    if (!client) {
      cookieStore.delete(publicClientCookieName(slug))
      return NextResponse.json({ client: null }, { status: 200 })
    }

    return NextResponse.json({ client: toPublicClientSession(client) })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar sessão" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const cookieStore = await cookies()
  cookieStore.delete(publicClientCookieName(slug))
  return NextResponse.json({ ok: true })
}
