import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { isValidPortalToken } from "@/lib/barber-portal-resolve"
import { barberPortalCookieName, verifyBarberPortalSession } from "@/lib/barber-portal-session"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import { hasFeature } from "@/lib/plans"
import { expireStaleWaitlistNotifications } from "@/lib/waitlist-service"
import { waitlistApiInclude, mapWaitingListRowToApi } from "@/lib/waitlist-map"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params
    if (!isValidPortalToken(portalToken)) {
      return NextResponse.json({ error: "Link inválido" }, { status: 400 })
    }
    const raw = (await cookies()).get(barberPortalCookieName())?.value
    const session = verifyBarberPortalSession(portalToken, raw)
    if (!session) {
      return NextResponse.json({ error: "Faça login." }, { status: 401 })
    }

    const barber = await prisma.barber.findFirst({
      where: {
        id: session.barberId,
        barbershopId: session.barbershopId,
        portalToken,
        active: true,
      },
      select: { id: true, barbershopId: true },
    })
    if (!barber) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 })
    }

    const plan = await resolveEffectivePlanForBarbershop(barber.barbershopId)
    if (!plan || !hasFeature(plan, "waiting_list")) {
      return NextResponse.json({
        enabled: false,
        items: [] as ReturnType<typeof mapWaitingListRowToApi>[],
        message: "Lista de espera não está ativa no plano desta barbearia.",
      })
    }

    await expireStaleWaitlistNotifications(barber.barbershopId)

    const rows = await prisma.waitingListItem.findMany({
      where: {
        barbershopId: barber.barbershopId,
        barberId: barber.id,
        status: { in: ["waiting", "notified"] },
      },
      include: waitlistApiInclude,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({
      enabled: true,
      items: rows.map(mapWaitingListRowToApi),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}
