import { NextResponse } from "next/server"
import { getActiveBarbershopBySlug } from "@/lib/public-booking"
import { appendClientOAuthPendingCookie } from "@/lib/client-oauth-pending-cookie"

export const dynamic = "force-dynamic"

/** Grava slug/modo em cookie antes do redirect Google — callback usa URL fixa no Supabase. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug: rawSlug } = await params
    const slug = rawSlug.trim()
    const shop = await getActiveBarbershopBySlug(slug)
    if (!shop || shop.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      mode?: string
      nome?: string
      telefone?: string
    }
    const mode = body.mode === "register" ? "register" : "login"
    const nome = typeof body.nome === "string" ? body.nome.trim() : undefined
    const telefone = typeof body.telefone === "string" ? body.telefone.trim() : undefined

    const res = NextResponse.json({ ok: true })
    appendClientOAuthPendingCookie(res, { slug, mode, nome, telefone })
    return res
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao preparar login" },
      { status: 500 }
    )
  }
}
