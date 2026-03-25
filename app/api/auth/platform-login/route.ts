import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { BARBERSHOP_ID_COOKIE } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

/**
 * Login da equipe Trim Time (super_admin).
 * Entrada permitida se:
 * - o e-mail coincide com SUPER_ADMIN_EMAIL (Vercel/local), ou
 * - a barbearia já tem role super_admin no banco (útil quando SUPER_ADMIN_EMAIL não está na Vercel).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { email: string }
    const email = body.email?.trim()?.toLowerCase()
    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 })
    }

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim()?.toLowerCase()
    const envMatch = !!superAdminEmail && email === superAdminEmail

    let barbershop = await prisma.barbershop.findFirst({
      where: { email },
      select: { id: true, role: true },
    })
    if (!barbershop) {
      return NextResponse.json(
        { error: "Email não cadastrado. Crie a conta barbearia antes." },
        { status: 401 }
      )
    }

    const dbSuperAdmin = barbershop.role === "super_admin"
    if (!envMatch && !dbSuperAdmin) {
      return NextResponse.json(
        {
          error:
            "Acesso restrito à equipe da plataforma. Defina SUPER_ADMIN_EMAIL na Vercel (Production) com este e-mail, " +
            "ou peça para marcar esta conta como super_admin no banco.",
        },
        { status: 403 }
      )
    }

    if (envMatch && barbershop.role !== "super_admin") {
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

    return NextResponse.json({
      ok: true,
      barbershop_id: barbershop.id,
      role: barbershop.role,
      redirect: "/plataforma",
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao fazer login" },
      { status: 500 }
    )
  }
}
