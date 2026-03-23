import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { BARBERSHOP_UNIT_COOKIE, requireBarbershopId } from "@/lib/tenant"

export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const body = (await request.json()) as { unit_id?: string | null }
    const cookieStore = await cookies()

    if (!body.unit_id) {
      cookieStore.delete(BARBERSHOP_UNIT_COOKIE)
      return NextResponse.json({ ok: true, unit_id: null })
    }

    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from("barbershop_units")
      .select("id")
      .eq("id", body.unit_id)
      .eq("barbershop_id", barbershopId)
      .maybeSingle()

    if (!data?.id) {
      return NextResponse.json({ error: "Unidade inválida para esta conta" }, { status: 400 })
    }

    cookieStore.set(BARBERSHOP_UNIT_COOKIE, data.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    return NextResponse.json({ ok: true, unit_id: data.id })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao trocar unidade" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

