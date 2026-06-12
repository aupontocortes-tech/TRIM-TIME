import { NextResponse } from "next/server"
import { sendPainelPasswordResetOtp } from "@/lib/painel-password-reset"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string }
    const email = String(body.email ?? "").trim()
    if (!email) {
      return NextResponse.json({ error: "Informe seu e-mail." }, { status: 400 })
    }

    const r = await sendPainelPasswordResetOtp(email)
    if ("error" in r) {
      return NextResponse.json({ error: r.error }, { status: r.status })
    }
    return NextResponse.json({
      ok: true,
      expires_in_seconds: r.expires_in_seconds,
      email_for_otp: r.email_for_otp,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao enviar código" },
      { status: 500 }
    )
  }
}
