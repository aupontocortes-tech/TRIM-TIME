import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { prisma } from "@/lib/prisma"
import { resolveGraphPhoneNumberIdForSave } from "@/lib/whatsapp-meta-resolver"

function friendlyPrismaError(message: string): string {
  if (
    message.includes("Unknown field") &&
    (message.includes("WhatsAppIntegration") || message.includes("graphPhoneNumberId"))
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
  connectedAt: Date
  apiToken: string | null
}) {
  return {
    id: row.id,
    phone_number: row.phoneNumber,
    graph_phone_number_id: row.graphPhoneNumberId ?? null,
    connected: Boolean(row.apiToken?.trim() && row.graphPhoneNumberId?.trim()),
    connected_at: row.connectedAt.toISOString(),
  }
}

const SELECT_FIELDS = {
  id: true,
  phoneNumber: true,
  graphPhoneNumberId: true,
  connectedAt: true,
  apiToken: true,
} as const

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
    return NextResponse.json(formatRow(row))
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
      graph_phone_number_id?: string | null
      api_token?: string | null
    }

    if (body.disconnect === true) {
      const exists = await prisma.whatsAppIntegration.findUnique({
        where: { barbershopId },
        select: { id: true },
      })
      if (exists) {
        await prisma.whatsAppIntegration.update({
          where: { barbershopId },
          data: { apiToken: null, graphPhoneNumberId: null },
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

    if (!body.phone_number?.trim()) {
      return NextResponse.json({ error: "Número é obrigatório" }, { status: 400 })
    }

    const phoneNumber = body.phone_number.trim()
    const graphIdInput = body.graph_phone_number_id?.trim() || null
    const token = body.api_token?.trim() || null

    if (!graphIdInput || !token) {
      return NextResponse.json({ error: "Informe o identificador do número e o token da Meta." }, { status: 400 })
    }

    const resolved = await resolveGraphPhoneNumberIdForSave(graphIdInput, token)
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 })
    }

    const graphId = resolved.phoneNumberId
    const displayPhone = resolved.displayPhone?.replace(/\D/g, "")
    const phoneToStore = displayPhone && displayPhone.length >= 10 ? displayPhone : phoneNumber

    const row = await prisma.whatsAppIntegration.upsert({
      where: { barbershopId },
      create: {
        barbershopId,
        phoneNumber: phoneToStore,
        apiProvider: "meta",
        apiToken: token,
        graphPhoneNumberId: graphId,
      },
      update: {
        phoneNumber: phoneToStore,
        graphPhoneNumberId: graphId,
        ...(token ? { apiToken: token } : {}),
      },
      select: SELECT_FIELDS,
    })

    return NextResponse.json({
      ...formatRow(row),
      meta_id_corrected_from_waba: resolved.correctedFromWaba,
      meta_phone_number_id_saved: graphId,
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
