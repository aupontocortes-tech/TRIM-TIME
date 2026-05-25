import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getActiveBarbershopBySlug } from "@/lib/public-booking"
import {
  publicClientCookieName,
  verifyPublicClientSession,
} from "@/lib/public-client-session"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string; itemId: string }> }
) {
  try {
    const { slug, itemId } = await params
    const shop = await getActiveBarbershopBySlug(slug)
    if (!shop || shop.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    const cookieStore = await cookies()
    const rawSession = cookieStore.get(publicClientCookieName(slug))?.value
    const session = verifyPublicClientSession(slug, rawSession)
    if (!session) {
      return NextResponse.json({ error: "Faça login." }, { status: 401 })
    }

    const item = await prisma.waitingListItem.findFirst({
      where: {
        id: itemId,
        barbershopId: shop.id,
        clientId: session.clientId,
        status: { in: ["waiting", "notified"] },
      },
      select: { id: true },
    })

    if (!item) {
      return NextResponse.json({ error: "Item não encontrado na fila." }, { status: 404 })
    }

    await prisma.waitingListItem.update({
      where: { id: item.id },
      data: { status: "canceled" },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao sair da fila" },
      { status: 500 }
    )
  }
}
