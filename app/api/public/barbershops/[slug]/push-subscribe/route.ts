import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getActiveBarbershopBySlug } from "@/lib/public-booking"
import { publicClientCookieName, verifyPublicClientSession } from "@/lib/public-client-session"

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

    const cookieStore = await cookies()
    const raw = cookieStore.get(publicClientCookieName(slug))?.value
    const session = verifyPublicClientSession(slug, raw)
    if (!session) {
      return NextResponse.json({ error: "Faça login no agendamento para ativar lembretes" }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as {
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    } | null
    const sub = body?.subscription
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return NextResponse.json({ error: "Subscription inválida" }, { status: 400 })
    }

    const client = await prisma.client.findFirst({
      where: { id: session.clientId, barbershopId: shop.id },
      select: { id: true },
    })
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
    }

    await prisma.client.update({
      where: { id: client.id },
      data: {
        pushSubscription: sub as object,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao salvar" },
      { status: 500 }
    )
  }
}

/** Remove subscription (logout ou desativar). */
export async function DELETE(
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
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    await prisma.client.updateMany({
      where: { id: session.clientId, barbershopId: shop.id },
      data: { pushSubscription: Prisma.DbNull },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}
