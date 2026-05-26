import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { isValidPortalToken } from "@/lib/barber-portal-resolve"
import { barberPortalCookieName, verifyBarberPortalSession } from "@/lib/barber-portal-session"

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
      return NextResponse.json({ authenticated: false }, { status: 200 })
    }

    const barber = await prisma.barber.findFirst({
      where: {
        id: session.barberId,
        barbershopId: session.barbershopId,
        portalToken,
        active: true,
      },
      select: {
        name: true,
        barbershop: { select: { name: true, slug: true, suspendedAt: true } },
      },
    })
    if (!barber || barber.barbershop.suspendedAt) {
      return NextResponse.json({ authenticated: false }, { status: 200 })
    }

    return NextResponse.json({
      authenticated: true,
      barber: { name: barber.name },
      barbershop: { name: barber.barbershop.name, slug: barber.barbershop.slug },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params
    if (!isValidPortalToken(portalToken)) {
      return NextResponse.json({ error: "Link inválido" }, { status: 400 })
    }
    const cookieStore = await cookies()
    const raw = cookieStore.get(barberPortalCookieName())?.value
    if (verifyBarberPortalSession(portalToken, raw)) {
      cookieStore.set(barberPortalCookieName(), "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}
