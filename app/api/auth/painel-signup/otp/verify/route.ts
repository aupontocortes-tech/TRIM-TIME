import { NextResponse } from "next/server"
import {
  normalizeSignupEmail,
  isValidSignupEmail,
  verifyPainelSignupOtp,
} from "@/lib/painel-signup-otp"
import { appendPainelSignupCookie } from "@/lib/painel-signup-session-cookie"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string }
    const email = String(body.email ?? "").trim()
    const code = String(body.code ?? "").trim()

    if (
      !email ||
      !isValidSignupEmail(normalizeSignupEmail(email)) ||
      !code
    ) {
      return NextResponse.json(
        { error: "Informe o e-mail e o código enviados para você." },
        { status: 400 }
      )
    }

    const r = await verifyPainelSignupOtp(email, code)
    if ("error" in r) {
      return NextResponse.json({ error: r.error }, { status: r.status })
    }

    const res = NextResponse.json({
      ok: true,
      signup_token: r.signup_token,
      expires_at: r.expires_at,
      email_canonical: r.email_canonical,
    })
    appendPainelSignupCookie(res, {
      e: r.email_canonical,
      t: r.signup_token,
      x: new Date(r.expires_at).getTime(),
    })
    return res
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao verificar código" },
      { status: 500 }
    )
  }
}
