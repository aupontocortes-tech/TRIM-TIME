import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import type { WhatsAppIntegration } from "@/lib/db/types"

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForBarbershop(barbershopId)
    if (!plan || !hasFeature(plan, "whatsapp_integration")) {
      return NextResponse.json(
        { error: getUpgradeMessage("whatsapp_integration") },
        { status: 403 }
      )
    }
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("whatsapp_integrations")
      .select("id, phone_number, api_provider, connected_at")
      .eq("barbershop_id", barbershopId)
      .single()
    if (error && error.code !== "PGRST116") return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data as Omit<WhatsAppIntegration, "api_token"> | null)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não autorizado" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

/** Conectar WhatsApp (salva credenciais após OAuth Meta). Não expor api_token no cliente. */
export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForBarbershop(barbershopId)
    if (!plan || !hasFeature(plan, "whatsapp_integration")) {
      return NextResponse.json(
        { error: getUpgradeMessage("whatsapp_integration") },
        { status: 403 }
      )
    }
    const supabase = createServiceRoleClient()
    const body = await request.json() as { phone_number: string; api_provider?: string; api_token?: string }
    if (!body.phone_number?.trim()) {
      return NextResponse.json({ error: "Número é obrigatório" }, { status: 400 })
    }
    const { data, error } = await supabase
      .from("whatsapp_integrations")
      .upsert({
        barbershop_id: barbershopId,
        phone_number: body.phone_number.trim(),
        api_provider: body.api_provider ?? "meta",
        api_token: body.api_token ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "barbershop_id" })
      .select("id, phone_number, api_provider, connected_at")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao conectar WhatsApp" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
