import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireBarbershopId } from "@/lib/tenant"
import type { Client } from "@/lib/db/types"

export async function GET(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim() || ""
    const supabase = createServiceRoleClient()
    let query = supabase
      .from("clients")
      .select("*")
      .eq("barbershop_id", barbershopId)
      .order("name")
    if (q) {
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    }
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as Client[])
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não autorizado" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const body = await request.json() as { name: string; phone?: string; email?: string; notes?: string }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("clients")
      .insert({
        barbershop_id: barbershopId,
        name: body.name.trim(),
        phone: body.phone?.trim() ?? null,
        email: body.email?.trim() ?? null,
        notes: body.notes?.trim() ?? null,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as Client)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar cliente" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
