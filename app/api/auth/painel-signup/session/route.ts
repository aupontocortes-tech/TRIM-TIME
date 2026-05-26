import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  PAINEL_SIGNUP_COOKIE,
  verifyPainelSignupSession,
} from "@/lib/painel-signup-session-cookie"

export const dynamic = "force-dynamic"

/** Sessão de cadastro após OTP ou OAuth (cookie httpOnly). */
export async function GET() {
  const jar = await cookies()
  const proof = verifyPainelSignupSession(jar.get(PAINEL_SIGNUP_COOKIE)?.value)
  const now = Date.now()
  if (!proof || proof.x <= now) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({
    ok: true,
    email_canonical: proof.e,
    signup_token: proof.t,
    expires_at: new Date(proof.x).toISOString(),
  })
}
