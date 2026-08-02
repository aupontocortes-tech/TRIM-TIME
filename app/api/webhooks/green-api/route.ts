import { NextResponse } from "next/server"
import { handleGreenApiInboundWebhook } from "@/lib/whatsapp-inbound-handler"

export const dynamic = "force-dynamic"

function verifyWebhookSecret(request: Request): boolean {
  const expected = process.env.GREEN_API_WEBHOOK_SECRET?.trim()
  if (!expected) return true
  const url = new URL(request.url)
  const fromQuery = url.searchParams.get("secret")
  const fromHeader = request.headers.get("x-green-api-webhook-secret")
  return fromQuery === expected || fromHeader === expected
}

export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const payload = await request.json()
    const result = await handleGreenApiInboundWebhook(payload)
    return NextResponse.json({ received: true, ...result })
  } catch (e) {
    console.error("[webhooks/green-api]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro no webhook" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "trim-time-green-api-webhook" })
}
