import { NextResponse } from "next/server"
import { processInactiveClientMarketing } from "@/lib/process-inactive-client-marketing"

export const dynamic = "force-dynamic"
export const maxDuration = 120

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const auth = request.headers.get("authorization")
  if (auth === `Bearer ${secret}`) return true
  const url = new URL(request.url)
  return url.searchParams.get("secret") === secret
}

/** Marketing de reativação — clientes inativos via WhatsApp (Premium + integração). */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  try {
    const stats = await processInactiveClientMarketing()
    return NextResponse.json({ ok: true, ...stats })
  } catch (e) {
    console.error("[cron/inactive-client-marketing]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao processar marketing de inativos" },
      { status: 500 }
    )
  }
}
