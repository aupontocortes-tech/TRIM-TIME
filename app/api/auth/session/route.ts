import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { BARBERSHOP_ID_COOKIE } from "@/lib/tenant"

/** Define a barbearia da sessão (após login). Recebe barbershop_id no body. */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { barbershop_id: string }
    const id = body.barbershop_id
    if (!id) {
      return NextResponse.json({ error: "barbershop_id obrigatório" }, { status: 400 })
    }
    const cookieStore = await cookies()
    cookieStore.set(BARBERSHOP_ID_COOKIE, id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao definir sessão" },
      { status: 500 }
    )
  }
}

/** Remove a barbearia da sessão (logout). */
export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(BARBERSHOP_ID_COOKIE)
  return NextResponse.json({ ok: true })
}
