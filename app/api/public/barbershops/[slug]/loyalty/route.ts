import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getActiveBarbershopBySlug } from "@/lib/public-booking"
import { publicClientCookieName, verifyPublicClientSession } from "@/lib/public-client-session"
import type { BarbershopSettings } from "@/lib/db/types"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import {
  computeClientLoyaltyStatus,
  isLoyaltyProgramActive,
  parseLoyaltyProgram,
} from "@/lib/loyalty-program"

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

    const plan = await resolveEffectivePlanForBarbershop(shop.id)
    const settings = (shop.settings as BarbershopSettings | null) ?? null
    const config = parseLoyaltyProgram(settings)
    const active = isLoyaltyProgramActive(settings, plan)

    const cookieStore = await cookies()
    const raw = cookieStore.get(publicClientCookieName(slug))?.value
    const session = verifyPublicClientSession(slug, raw)
    if (!session) {
      return NextResponse.json({
        active,
        loyalty: computeClientLoyaltyStatus(0, active ? config : null),
      })
    }

    const client = await prisma.client.findFirst({
      where: { id: session.clientId, barbershopId: shop.id },
      select: { loyaltyPoints: true },
    })
    if (!client) {
      return NextResponse.json({
        active,
        loyalty: computeClientLoyaltyStatus(0, active ? config : null),
      })
    }

    return NextResponse.json({
      active,
      loyalty: computeClientLoyaltyStatus(
        client.loyaltyPoints,
        active ? config : null
      ),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar fidelidade" },
      { status: 500 }
    )
  }
}
