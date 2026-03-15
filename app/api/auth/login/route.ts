import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { BARBERSHOP_ID_COOKIE } from "@/lib/tenant"

/** Login barbearia: busca por email e define sessão (barbershop_id). Em produção usar Supabase Auth + tabela de usuários. */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { email: string }
    const email = body.email?.trim()?.toLowerCase()
    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 })
    }
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("barbershops")
      .select("id")
      .eq("email", email)
      .single()
    if (error || !data) {
      return NextResponse.json({ error: "Email não encontrado" }, { status: 401 })
    }
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim()?.toLowerCase()
    if (superAdminEmail && email === superAdminEmail) {
      await supabase.from("barbershops").update({ role: "admin", updated_at: new Date().toISOString() }).eq("id", data.id)
    }
    const cookieStore = await cookies()
    cookieStore.set(BARBERSHOP_ID_COOKIE, data.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
    return NextResponse.json({ ok: true, barbershop_id: data.id })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao fazer login" },
      { status: 500 }
    )
  }
}
