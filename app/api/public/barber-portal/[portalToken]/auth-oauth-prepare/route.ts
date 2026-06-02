import { NextResponse } from "next/server"
import { appendBarberOAuthPendingCookie } from "@/lib/barber-oauth-pending-cookie"
import { isValidPortalToken } from "@/lib/barber-portal-resolve"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params
    const pt = String(portalToken ?? "").trim()
    if (!isValidPortalToken(pt)) {
      return NextResponse.json({ error: "Link inválido" }, { status: 400 })
    }

    const res = NextResponse.json({ ok: true })
    appendBarberOAuthPendingCookie(res, {
      flow: "portal_login",
      portalToken: pt,
    })
    return res
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao preparar login com Google" },
      { status: 500 }
    )
  }
}
