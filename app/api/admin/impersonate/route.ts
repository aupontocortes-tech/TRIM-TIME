import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { IMPERSONATE_COOKIE } from "@/lib/tenant"

/** Verifica se o usuário é super_admin e se está impersonando. */
export async function GET() {
  try {
    const auth = await requireSuperAdmin()
    if (!auth.ok) return NextResponse.json({ impersonating: false, isAdmin: false })
    const cookieStore = await cookies()
    const impersonating = !!cookieStore.get(IMPERSONATE_COOKIE)?.value
    return NextResponse.json({ impersonating, isAdmin: true })
  } catch {
    return NextResponse.json({ impersonating: false, isAdmin: false })
  }
}

/** Definir ou limpar impersonação. Apenas super_admin. */
export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (!auth.ok) return auth.response

    const body = await request.json() as { barbershop_id?: string }
    const cookieStore = await cookies()

    if (!body.barbershop_id) {
      cookieStore.delete(IMPERSONATE_COOKIE)
      return NextResponse.json({ ok: true, redirect: "/plataforma" })
    }

    cookieStore.set(IMPERSONATE_COOKIE, body.barbershop_id, {
      path: "/",
      maxAge: 60 * 60 * 2,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
    return NextResponse.json({ ok: true, redirect: "/painel" })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}
