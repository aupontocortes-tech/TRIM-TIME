import { NextResponse } from "next/server"
import { getActiveBarbershopBySlug } from "@/lib/public-booking"
import { createServiceRoleClient, createClient } from "@/lib/supabase/server"
import { completeClientOAuthForBarbershop } from "@/lib/client-oauth-complete"
import { appendClientSessionCookie } from "@/lib/client-oauth-callback"

type Body = {
  mode?: "register" | "login"
  nome?: string
  telefone?: string
}

function asStr(v: unknown) {
  return typeof v === "string" ? v.trim() : ""
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const shop = await getActiveBarbershopBySlug(slug)
    if (!shop || shop.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization")
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
    const body = (await request.json().catch(() => ({}))) as Body
    const mode: "register" | "login" = body.mode === "register" ? "register" : "login"

    let email: string | null = null

    if (bearer) {
      const supabase = createServiceRoleClient()
      const userResp = await supabase.auth.getUser(bearer)
      email = userResp.data.user?.email?.trim().toLowerCase() ?? null
    } else {
      const supabase = await createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      email = session?.user?.email?.trim().toLowerCase() ?? null
    }

    if (!email) {
      return NextResponse.json(
        { error: "Sessão do Google inválida ou expirada. Tente entrar com Google de novo." },
        { status: 401 }
      )
    }

    const result = await completeClientOAuthForBarbershop({
      barbershopId: shop.id,
      email,
      mode,
      nome: asStr(body.nome),
      telefone: asStr(body.telefone),
    })

    if (!result.ok) {
      const status =
        result.code === "not_registered"
          ? 404
          : result.code === "phone_conflict"
            ? 409
            : result.code === "incomplete_register" || result.code === "invalid_phone"
              ? 400
              : 404
      return NextResponse.json({ error: result.error }, { status })
    }

    const res = NextResponse.json({ ok: true, client: result.client })
    appendClientSessionCookie(res, slug, result.client.id)
    return res
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao concluir autenticação" },
      { status: 500 }
    )
  }
}
