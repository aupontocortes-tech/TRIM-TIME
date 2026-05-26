import { NextResponse } from "next/server"
import {
  normalizeSignupEmail,
  isValidSignupEmail,
  sendPainelSignupOtp,
} from "@/lib/painel-signup-otp"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string; phone?: string }
    const raw = String(body.email ?? "").trim()
    if (!raw || !isValidSignupEmail(normalizeSignupEmail(raw))) {
      return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400 })
    }

    const phone =
      typeof body.phone === "string" && body.phone.replace(/\D/g, "").length >= 10
        ? body.phone.trim()
        : undefined

    const r = await sendPainelSignupOtp(raw, { phone })
    if ("error" in r) {
      return NextResponse.json({ error: r.error }, { status: r.status })
    }
    return NextResponse.json({
      ok: true,
      expires_in_seconds: r.expires_in_seconds,
      email_canonical: r.email_canonical,
      email_for_otp: r.email_for_otp,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao enviar código" },
      { status: 500 }
    )
  }
}
