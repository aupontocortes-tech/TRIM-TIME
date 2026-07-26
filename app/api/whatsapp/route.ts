import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { prisma } from "@/lib/prisma"
import {
  GREEN_API_STATE_LABELS,
  resolveGreenApiBaseUrl,
  validateGreenApiCredentials,
} from "@/lib/whatsapp-green-api"

function friendlyPrismaError(message: string): string {
  if (
    message.includes("Unknown field") &&
    (message.includes("WhatsAppIntegration") ||
      message.includes("graphPhoneNumberId") ||
      message.includes("greenApiBaseUrl"))
  ) {
    return (
      "O Prisma Client está desatualizado. " +
      "Pare o servidor (Ctrl+C), rode `npx prisma generate` e `npx prisma db push`, " +
      "depois inicie de novo com `npm run dev`."
    )
  }
  return message
}

function formatRow(row: {
  id: string
  phoneNumber: string
  graphPhoneNumberId: string | null
  greenApiBaseUrl: string | null
  connectedAt: Date
  apiToken: string | null
  apiProvider: string
}) {
  const connected = Boolean(row.apiToken?.trim() && row.graphPhoneNumberId?.trim())
  return {
    id: row.id,
    phone_number: row.phoneNumber,
    id_instance: row.graphPhoneNumberId ?? null,
    graph_phone_number_id: row.graphPhoneNumberId ?? null,
    green_api_base_url: row.greenApiBaseUrl ?? null,
    api_provider: row.apiProvider,
    connected,
    connected_at: row.connectedAt.toISOString(),
  }
}

const SELECT_FIELDS = {
  id: true,
  phoneNumber: true,
  graphPhoneNumberId: true,
  greenApiBaseUrl: true,
  connectedAt: true,
  apiToken: true,
  apiProvider: true,
} as const

async function ensureGreenApiBaseUrl(
  barbershopId: string,
  idInstance: string,
  apiToken: string,
  storedBaseUrl: string | null | undefined
): Promise<string | null> {
  if (storedBaseUrl?.trim()) return storedBaseUrl.trim()
  const resolved = await resolveGreenApiBaseUrl(idInstance, apiToken)
  if (!resolved) return null
  try {
    await prisma.whatsAppIntegration.update({
      where: { barbershopId },
      data: { greenApiBaseUrl: resolved },
    })
  } catch (e) {
    console.warn("[whatsapp GET] não foi possível salvar greenApiBaseUrl:", e)
  }
  return resolved
}

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "whatsapp_integration")) {
      return NextResponse.json(
        { error: getUpgradeMessage("whatsapp_integration") },
        { status: 403 }
      )
    }
    const row = await prisma.whatsAppIntegration.findUnique({
      where: { barbershopId },
      select: SELECT_FIELDS,
    })
    if (!row) return NextResponse.json(null)

    const base = formatRow(row)
    if (!base.connected || !row.apiToken?.trim() || !row.graphPhoneNumberId?.trim()) {
      return NextResponse.json(base)
    }

    const baseUrl = await ensureGreenApiBaseUrl(
      barbershopId,
      row.graphPhoneNumberId,
      row.apiToken,
      row.greenApiBaseUrl
    )

    const live = await validateGreenApiCredentials(
      row.graphPhoneNumberId,
      row.apiToken,
      baseUrl ?? row.greenApiBaseUrl
    )
    if (!live.ok) {
      return NextResponse.json({
        ...base,
        state_instance: null,
        state_label: live.error,
        ready_to_send: false,
      })
    }

    return NextResponse.json({
      ...base,
      state_instance: live.stateInstance,
      state_label: GREEN_API_STATE_LABELS[live.stateInstance] ?? live.stateInstance,
      ready_to_send: live.readyToSend,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Não autorizado"
    return NextResponse.json(
      { error: friendlyPrismaError(msg) },
      { status: e instanceof Error && msg.includes("não identificada") ? 401 : 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const body = await request.json() as {
      disconnect?: boolean
      phone_number?: string
      id_instance?: string | null
      graph_phone_number_id?: string | null
      api_token_instance?: string | null
      api_token?: string | null
      green_api_base_url?: string | null
      api_url?: string | null
    }

    if (body.disconnect === true) {
      const exists = await prisma.whatsAppIntegration.findUnique({
        where: { barbershopId },
        select: { id: true },
      })
      if (exists) {
        await prisma.whatsAppIntegration.update({
          where: { barbershopId },
          data: { apiToken: null, graphPhoneNumberId: null, greenApiBaseUrl: null },
        })
      }
      const row = await prisma.whatsAppIntegration.findUnique({
        where: { barbershopId },
        select: SELECT_FIELDS,
      })
      if (!row) return NextResponse.json(null)
      return NextResponse.json(formatRow(row))
    }

    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "whatsapp_integration")) {
      return NextResponse.json(
        { error: getUpgradeMessage("whatsapp_integration") },
        { status: 403 }
      )
    }

    const idInstance = (body.id_instance ?? body.graph_phone_number_id)?.trim() || null
    const apiTokenInstance = (body.api_token_instance ?? body.api_token)?.trim() || null
    const phoneInput = body.phone_number?.trim() || ""
    const explicitBaseUrl = (body.green_api_base_url ?? body.api_url)?.trim() || null

    if (!idInstance || !apiTokenInstance) {
      return NextResponse.json(
        { error: "Informe idInstance e apiTokenInstance da Green API." },
        { status: 400 }
      )
    }

    if (!/^\d+$/.test(idInstance)) {
      return NextResponse.json(
        { error: "idInstance deve conter apenas números (copie do console Green API)." },
        { status: 400 }
      )
    }

    const validated = await validateGreenApiCredentials(idInstance, apiTokenInstance, explicitBaseUrl)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const greenApiBaseUrl = validated.baseUrl

    const phoneFromApi = validated.phone?.replace(/\D/g, "")
    const phoneToStore =
      phoneFromApi && phoneFromApi.length >= 10
        ? phoneFromApi
        : phoneInput.replace(/\D/g, "").length >= 10
          ? phoneInput.replace(/\D/g, "")
          : phoneInput.trim()

    if (!phoneToStore) {
      return NextResponse.json(
        {
          error:
            "Informe o número WhatsApp da barbearia ou autorize a instância no console Green API (QR Code) antes de salvar.",
        },
        { status: 400 }
      )
    }

    const row = await prisma.whatsAppIntegration.upsert({
      where: { barbershopId },
      create: {
        barbershopId,
        phoneNumber: phoneToStore,
        apiProvider: "green_api",
        apiToken: apiTokenInstance,
        graphPhoneNumberId: idInstance,
        greenApiBaseUrl,
      },
      update: {
        phoneNumber: phoneToStore,
        apiProvider: "green_api",
        graphPhoneNumberId: idInstance,
        apiToken: apiTokenInstance,
        greenApiBaseUrl,
      },
      select: SELECT_FIELDS,
    })

    return NextResponse.json({
      ...formatRow(row),
      state_instance: validated.stateInstance,
      state_label: GREEN_API_STATE_LABELS[validated.stateInstance] ?? validated.stateInstance,
      ready_to_send: validated.readyToSend,
      green_api_authorized: validated.readyToSend,
    })
  } catch (e) {
    console.error("[whatsapp POST]", e)
    const msg = e instanceof Error ? e.message : "Erro ao salvar"
    return NextResponse.json(
      { error: friendlyPrismaError(msg) },
      { status: e instanceof Error && msg.includes("não identificada") ? 401 : 500 }
    )
  }
}
