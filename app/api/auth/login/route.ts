import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { BARBERSHOP_ID_COOKIE } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

/**
 * Login da barbearia (e super admin): email → cookie `trimtime_barbershop_id`.
 * Resposta inclui `redirect`: super_admin → /admin; demais → /dashboard-barbearia (painel).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { email: string }
    const email = body.email?.trim()?.toLowerCase()
    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 })
    }

    let barbershop = await prisma.barbershop.findFirst({
      where: { email },
      select: { id: true, role: true },
    })
    if (!barbershop) {
      return NextResponse.json({ error: "Email não encontrado" }, { status: 401 })
    }

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim()?.toLowerCase()
    if (superAdminEmail && email === superAdminEmail && barbershop.role !== "super_admin") {
      await prisma.barbershop.update({
        where: { id: barbershop.id },
        data: { role: "super_admin" },
      })
      barbershop = { id: barbershop.id, role: "super_admin" }
    }

    const cookieStore = await cookies()
    cookieStore.set(BARBERSHOP_ID_COOKIE, barbershop.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    const redirect =
      barbershop.role === "super_admin" ? "/admin" : "/dashboard-barbearia"

    return NextResponse.json({
      ok: true,
      barbershop_id: barbershop.id,
      role: barbershop.role,
      redirect,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao fazer login" },
      { status: 500 }
    )
  }
}
