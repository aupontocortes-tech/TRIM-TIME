import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"

/**
 * Recebe o código do Embedded Signup da Meta e persiste a integração.
 * Requer variáveis de ambiente da Meta configuradas no servidor.
 */
export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "whatsapp_integration")) {
      return NextResponse.json({ error: getUpgradeMessage("whatsapp_integration") }, { status: 403 })
    }

    const appId = process.env.META_APP_ID?.trim()
    const appSecret = process.env.META_APP_SECRET?.trim()
    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: "Integração Meta ainda não configurada na plataforma. Tente novamente em breve." },
        { status: 503 }
      )
    }

    const body = (await request.json()) as { code?: string }
    const code = body.code?.trim()
    if (!code) {
      return NextResponse.json({ error: "Código de autorização inválido" }, { status: 400 })
    }

    // Troca code por access token (fluxo Embedded Signup)
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token")
    tokenUrl.searchParams.set("client_id", appId)
    tokenUrl.searchParams.set("client_secret", appSecret)
    tokenUrl.searchParams.set("code", code)

    const tokenRes = await fetch(tokenUrl.toString())
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string
      error?: { message?: string }
    }

    if (!tokenRes.ok || !tokenJson.access_token) {
      return NextResponse.json(
        { error: tokenJson.error?.message ?? "Não foi possível obter o token da Meta" },
        { status: 502 }
      )
    }

    // TODO: buscar WABA ID, phone_number_id e número via Graph API e salvar com prisma
    return NextResponse.json(
      {
        error:
          "Token recebido. Finalize a configuração dos endpoints Graph (WABA e Phone Number ID) no servidor.",
      },
      { status: 501 }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao conectar"
    return NextResponse.json(
      { error: msg },
      { status: e instanceof Error && msg.includes("não identificada") ? 401 : 500 }
    )
  }
}
