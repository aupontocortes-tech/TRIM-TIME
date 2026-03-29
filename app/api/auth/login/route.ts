import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { BARBERSHOP_ID_COOKIE } from "@/lib/tenant"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { withBarbershopPasswordHash, getBarbershopPasswordHash } from "@/lib/barbershop-auth-settings"
import { prisma } from "@/lib/prisma"

/**
 * Login do app barbearias: email → cookie → /dashboard-barbearia.
 * Conta com role super_admin (ou e-mail = SUPER_ADMIN_EMAIL) usa /plataforma/login — não entra aqui.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { email: string; password: string }
    const email = body.email?.trim()?.toLowerCase()
    const password = body.password?.trim()
    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 })
    }

    const barbershop = await prisma.barbershop.findFirst({
      where: { email },
      select: { id: true, role: true, settings: true, suspendedAt: true },
    })
    if (!barbershop) {
      return NextResponse.json({ error: "Email não encontrado" }, { status: 401 })
    }
    if (barbershop.suspendedAt) {
      return NextResponse.json({ error: "Conta suspensa. Entre em contato com o suporte." }, { status: 403 })
    }

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim()?.toLowerCase()
    const mustUsePlataforma =
      barbershop.role === "super_admin" || (!!superAdminEmail && email === superAdminEmail)
    if (mustUsePlataforma) {
      return NextResponse.json(
        {
          error:
            "Este e-mail é da equipe da plataforma. Use o acesso Plataforma Trim Time (link na tela de login).",
          usePlatformLogin: true,
        },
        { status: 403 }
      )
    }

    const storedHash = getBarbershopPasswordHash(barbershop.settings)
    if (!storedHash) {
      await prisma.barbershop.update({
        where: { id: barbershop.id },
        data: { settings: withBarbershopPasswordHash(barbershop.settings, hashPassword(password)) },
      })
    } else if (!verifyPassword(password, storedHash)) {
      return NextResponse.json({ error: "Email ou senha inválidos" }, { status: 401 })
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
      redirect: "/dashboard-barbearia",
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao fazer login" },
      { status: 500 }
    )
  }
}
