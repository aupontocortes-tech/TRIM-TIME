import { NextResponse } from "next/server"
import { getAsaasWebhookToken } from "@/lib/asaas/config"
import { handleAsaasWebhook } from "@/lib/asaas/webhook-handler"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const token = getAsaasWebhookToken()
  if (token) {
    const header =
      request.headers.get("asaas-access-token") ||
      request.headers.get("x-asaas-access-token")
    if (header !== token) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
  }

  try {
    const payload = await request.json()
    await handleAsaasWebhook(payload)
    return NextResponse.json({ received: true })
  } catch (e) {
    console.error("[webhooks/asaas]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro no webhook" },
      { status: 500 }
    )
  }
}
