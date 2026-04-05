import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { prisma } from "@/lib/prisma"

const WHATSAPP_PROVIDERS = new Set(["meta", "twilio", "zenvia", "360dialog"])

/** Evita expor o dump inteiro do Prisma quando o client ficou velho no hot reload do Next. */
function friendlyWhatsappPrismaError(message: string): string {
  if (
    message.includes("Unknown field") &&
    (message.includes("WhatsAppIntegration") || message.includes("graphPhoneNumberId"))
  ) {
    return (
      "O Prisma Client está desatualizado (comum após atualizar o schema). " +
      "Pare o servidor (Ctrl+C), rode `npx prisma generate` e `npx prisma db push`, " +
      "depois inicie de novo com `npm run dev`."
    )
  }
  return message
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
      select: {
        id: true,
        phoneNumber: true,
        apiProvider: true,
        graphPhoneNumberId: true,
        connectedAt: true,
        apiToken: true,
      },
    })
    if (!row) {
      return NextResponse.json(null)
    }
    return NextResponse.json({
      id: row.id,
      phone_number: row.phoneNumber,
      graph_phone_number_id: row.graphPhoneNumberId ?? null,
      api_provider: row.apiProvider,
      has_api_token: Boolean(row.apiToken?.trim()),
      connected_at: row.connectedAt.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Não autorizado"
    return NextResponse.json(
      { error: friendlyWhatsappPrismaError(msg) },
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
      api_provider?: string
      api_token?: string | null
      clear_api_token?: boolean
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
        select: {
          id: true,
          phoneNumber: true,
          apiProvider: true,
          graphPhoneNumberId: true,
          connectedAt: true,
          apiToken: true,
        },
      })
      if (!row) {
        return NextResponse.json(null)
      }
      return NextResponse.json({
        id: row.id,
        phone_number: row.phoneNumber,
        graph_phone_number_id: row.graphPhoneNumberId ?? null,
        api_provider: row.apiProvider,
        has_api_token: Boolean(row.apiToken?.trim()),
        connected_at: row.connectedAt.toISOString(),
      })
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
    const rawProvider = body.api_provider?.trim().toLowerCase() || "meta"
    const apiProvider = WHATSAPP_PROVIDERS.has(rawProvider) ? rawProvider : "meta"
    const graphId =
      body.graph_phone_number_id !== undefined
        ? body.graph_phone_number_id?.trim() || null
        : undefined

    const tokenUpdate =
      body.clear_api_token === true
        ? null
        : typeof body.api_token === "string" && body.api_token.trim()
          ? body.api_token.trim()
          : undefined

    const row = await prisma.whatsAppIntegration.upsert({
      where: { barbershopId },
      create: {
        barbershopId,
        phoneNumber,
        apiProvider,
        apiToken: tokenUpdate ?? null,
        graphPhoneNumberId: graphId === undefined ? null : graphId,
      },
      update: {
        phoneNumber,
        apiProvider,
        ...(graphId !== undefined ? { graphPhoneNumberId: graphId } : {}),
        ...(tokenUpdate !== undefined ? { apiToken: tokenUpdate } : {}),
      },
      select: {
        id: true,
        phoneNumber: true,
        apiProvider: true,
        graphPhoneNumberId: true,
        connectedAt: true,
        apiToken: true,
      },
    })

    return NextResponse.json({
      id: row.id,
      phone_number: row.phoneNumber,
      graph_phone_number_id: row.graphPhoneNumberId,
      api_provider: row.apiProvider,
      has_api_token: Boolean(row.apiToken?.trim()),
      connected_at: row.connectedAt.toISOString(),
    })
  } catch (e) {
    console.error("[whatsapp POST]", e)
    const msg = e instanceof Error ? e.message : "Erro ao salvar"
    return NextResponse.json(
      { error: friendlyWhatsappPrismaError(msg) },
      { status: e instanceof Error && msg.includes("não identificada") ? 401 : 500 }
    )
  }
}
