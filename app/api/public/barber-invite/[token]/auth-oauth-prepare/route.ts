import { NextResponse } from "next/server"
import { appendBarberOAuthPendingCookie } from "@/lib/barber-oauth-pending-cookie"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const t = String(token ?? "").trim()
    if (t.length < 32) {
      return NextResponse.json({ error: "Link inválido" }, { status: 400 })
    }

    const res = NextResponse.json({ ok: true })
    appendBarberOAuthPendingCookie(res, {
      flow: "invite_register",
      inviteToken: t,
    })
    return res
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao preparar cadastro com Google" },
      { status: 500 }
    )
  }
}
