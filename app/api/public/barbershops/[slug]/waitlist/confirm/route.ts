import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getActiveBarbershopBySlug } from "@/lib/public-booking"
import {
  publicClientCookieName,
  verifyPublicClientSession,
} from "@/lib/public-client-session"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import { hasFeature } from "@/lib/plans"
import type { BarbershopSettings } from "@/lib/db/types"
import { expireStaleWaitlistNotifications } from "@/lib/waitlist-service"
import { expireStaleAppointmentsForBarbershop } from "@/lib/appointment-expiry"
import { verifyWaitlistConfirmToken } from "@/lib/waitlist-confirm-token"
import { acceptWaitlistOffer } from "@/lib/waitlist-accept-core"
import { prisma } from "@/lib/prisma"

async function resolveClientIdForConfirm(
  slug: string,
  shopId: string,
  token: string | null,
  itemIdFromToken: string | null
): Promise<string | null> {
  if (token) {
    const parsed = verifyWaitlistConfirmToken(slug, token)
    if (!parsed) return null
    const item = await prisma.waitingListItem.findFirst({
      where: { id: parsed.itemId, barbershopId: shopId },
      select: { clientId: true },
    })
    return item?.clientId ?? null
  }

  const cookieStore = await cookies()
  const rawSession = cookieStore.get(publicClientCookieName(slug))?.value
  const session = verifyPublicClientSession(slug, rawSession)
  if (!session) return null

  if (itemIdFromToken) {
    const item = await prisma.waitingListItem.findFirst({
      where: { id: itemIdFromToken, barbershopId: shopId, clientId: session.clientId },
      select: { clientId: true },
    })
    return item?.clientId ?? null
  }

  return session.clientId
}

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

    await expireStaleAppointmentsForBarbershop(shop.id)

    const plan = await resolveEffectivePlanForBarbershop(shop.id)
    if (!plan || !hasFeature(plan, "waiting_list")) {
      return NextResponse.json({ error: "Lista de espera não disponível neste plano." }, { status: 403 })
    }

    await expireStaleWaitlistNotifications(shop.id)

    const body = (await request.json().catch(() => ({}))) as {
      token?: string
      item_id?: string
    }

    const token = typeof body.token === "string" ? body.token.trim() : null
    const parsedToken = token ? verifyWaitlistConfirmToken(slug, token) : null
    const itemId = parsedToken?.itemId ?? (typeof body.item_id === "string" ? body.item_id : null)

    if (!itemId && !token) {
      return NextResponse.json({ error: "Link ou sessão inválidos." }, { status: 400 })
    }

    const clientId = await resolveClientIdForConfirm(slug, shop.id, token, itemId)
    if (!clientId || !itemId) {
      return NextResponse.json(
        { error: token ? "Link inválido ou expirado." : "Faça login para confirmar o horário." },
        { status: token ? 400 : 401 }
      )
    }

    const settings = (shop.settings as BarbershopSettings | null) ?? null
    const result = await acceptWaitlistOffer({
      barbershopId: shop.id,
      itemId,
      clientId,
      settings,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      ok: true,
      appointment_ids: result.appointmentIds,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao confirmar" },
      { status: 500 }
    )
  }
}
