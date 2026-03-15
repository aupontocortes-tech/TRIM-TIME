import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getBarbershopIdFromRequest } from "@/lib/tenant"
import { createTrialEndDate } from "@/lib/subscription"
import type { Barbershop } from "@/lib/db/types"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function GET() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json(
        { error: "Barbershop não identificada" },
        { status: 401 }
      )
    }
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("barbershops")
      .select("*")
      .eq("id", barbershopId)
      .single()
    if (error) {
      if (error.code === "PGRST116") return NextResponse.json(null, { status: 404 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const barbershopData = data as Barbershop & { suspended_at?: string | null }
    if (barbershopData.suspended_at) {
      return NextResponse.json(
        { error: "Conta suspensa. Entre em contato com o suporte." },
        { status: 403 }
      )
    }
    return NextResponse.json(data as Barbershop)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao buscar barbearia" },
      { status: 500 }
    )
  }
}

/** Cadastro de nova barbearia: cria barbershop + assinatura em trial (7 dias Premium) */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { name: string; email: string; phone?: string }
    if (!body.name?.trim() || !body.email?.trim()) {
      return NextResponse.json(
        { error: "Nome e email são obrigatórios" },
        { status: 400 }
      )
    }
    const supabase = createServiceRoleClient()
    let slug = slugify(body.name)
    const { data: existing } = await supabase.from("barbershops").select("id").eq("slug", slug).single()
    if (existing) slug = `${slug}-${Date.now().toString(36)}`
    const emailLower = body.email.trim().toLowerCase()
    const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && emailLower === process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase()
    const { data: barbershop, error: errBarbershop } = await supabase
      .from("barbershops")
      .insert({
        name: body.name.trim(),
        email: emailLower,
        phone: body.phone?.trim() ?? null,
        slug,
        ...(isSuperAdmin ? { role: "admin" } : {}),
      })
      .select()
      .single()
    if (errBarbershop) return NextResponse.json({ error: errBarbershop.message }, { status: 500 })
    const trialEnd = createTrialEndDate()
    await supabase.from("subscriptions").insert({
      barbershop_id: (barbershop as Barbershop).id,
      plan: "premium",
      status: "trial",
      trial_end: trialEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    return NextResponse.json(barbershop as Barbershop)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao cadastrar barbearia" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json(
        { error: "Barbershop não identificada" },
        { status: 401 }
      )
    }
    const body = await request.json() as Partial<Pick<Barbershop, "name" | "email" | "phone">>
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("barbershops")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", barbershopId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as Barbershop)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar barbearia" },
      { status: 500 }
    )
  }
}
