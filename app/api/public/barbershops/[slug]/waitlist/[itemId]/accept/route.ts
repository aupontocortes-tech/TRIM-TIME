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
import { acceptWaitlistOffer } from "@/lib/waitlist-accept-core"

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

    await expireStaleAppointmentsForBarbershop(shop.id)

    const plan = await resolveEffectivePlanForBarbershop(shop.id)
    if (!plan || !hasFeature(plan, "waiting_list")) {
      return NextResponse.json({ error: "Lista de espera não disponível neste plano." }, { status: 403 })
    }

    await expireStaleWaitlistNotifications(shop.id)

    const cookieStore = await cookies()
    const rawSession = cookieStore.get(publicClientCookieName(slug))?.value
    const session = verifyPublicClientSession(slug, rawSession)
    if (!session) {
      return NextResponse.json({ error: "Faça login para confirmar o horário." }, { status: 401 })
    }

    const settings = (shop.settings as BarbershopSettings | null) ?? null
    const result = await acceptWaitlistOffer({
      barbershopId: shop.id,
      itemId,
      clientId: session.clientId,
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
