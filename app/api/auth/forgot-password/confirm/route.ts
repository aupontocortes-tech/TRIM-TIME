import { NextResponse } from "next/server"
import { confirmPainelPasswordReset } from "@/lib/painel-password-reset"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string
      code?: string
      password?: string
    }
    const email = String(body.email ?? "").trim()
    const code = String(body.code ?? "").trim()
    const password = String(body.password ?? "")

    const r = await confirmPainelPasswordReset(email, code, password)
    if ("error" in r) {
      return NextResponse.json({ error: r.error }, { status: r.status })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao redefinir senha" },
      { status: 500 }
    )
  }
}
