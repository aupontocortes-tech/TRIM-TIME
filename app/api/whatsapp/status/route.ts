import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { prisma } from "@/lib/prisma"
import {
  GREEN_API_STATE_LABELS,
  validateGreenApiCredentials,
} from "@/lib/whatsapp-green-api"

/** Consulta ao vivo o status da instância Green API (QR autorizado ou não). */
export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "whatsapp_integration")) {
      return NextResponse.json(
        { error: getUpgradeMessage("whatsapp_integration") },
        { status: 403 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as {
      id_instance?: string
      api_token_instance?: string
    }

    let idInstance = body.id_instance?.trim()
    let apiTokenInstance = body.api_token_instance?.trim()

    if (!idInstance || !apiTokenInstance) {
      const row = await prisma.whatsAppIntegration.findUnique({
        where: { barbershopId },
        select: { graphPhoneNumberId: true, apiToken: true },
      })
      idInstance = row?.graphPhoneNumberId?.trim()
      apiTokenInstance = row?.apiToken?.trim()
    }

    if (!idInstance || !apiTokenInstance) {
      return NextResponse.json(
        { error: "Informe idInstance e apiTokenInstance ou salve as credenciais primeiro." },
        { status: 400 }
      )
    }

    const result = await validateGreenApiCredentials(idInstance, apiTokenInstance)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      state_instance: result.stateInstance,
      state_label: GREEN_API_STATE_LABELS[result.stateInstance] ?? result.stateInstance,
      ready_to_send: result.readyToSend,
      phone: result.phone ?? null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
