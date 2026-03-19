import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getRealBarbershopIdFromRequest, IMPERSONATE_COOKIE } from "@/lib/tenant"

/** Verifica se o usuário é super_admin e se está impersonando. */
export async function GET() {
  try {
    const barbershopId = await getRealBarbershopIdFromRequest()
    if (!barbershopId) return NextResponse.json({ impersonating: false, isAdmin: false })
    const supabase = createServiceRoleClient()
    const { data: me } = await supabase.from("barbershops").select("role").eq("id", barbershopId).single()
    const isAdmin = me?.role === "super_admin"
    const cookieStore = await cookies()
    const impersonating = isAdmin && !!cookieStore.get(IMPERSONATE_COOKIE)?.value
    return NextResponse.json({ impersonating, isAdmin })
  } catch {
    return NextResponse.json({ impersonating: false, isAdmin: false })
  }
}

/** Definir ou limpar impersonação. Apenas role=admin. */
export async function POST(request: Request) {
  try {
    const barbershopId = await getRealBarbershopIdFromRequest()
    if (!barbershopId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const supabase = createServiceRoleClient()
    const { data: me } = await supabase
      .from("barbershops")
      .select("role")
      .eq("id", barbershopId)
      .single()
    if (me?.role !== "super_admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 })

    const body = await request.json() as { barbershop_id?: string }
    const cookieStore = await cookies()

    if (!body.barbershop_id) {
      cookieStore.delete(IMPERSONATE_COOKIE)
      return NextResponse.json({ ok: true, redirect: "/admin" })
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
