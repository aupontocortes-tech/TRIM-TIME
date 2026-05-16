import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"

export const PAINEL_SIGNUP_COOKIE = "trimtime_painel_signup"

function sessionSecret() {
  return (
    process.env.PAINEL_SIGNUP_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "trimtime-dev-painel-signup-secret"
  )
}

export type PainelSignupSessionPayload = { e: string; t: string; x: number }

export function signPainelSignupSession(payload: PainelSignupSessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const sig = createHmac("sha256", `${sessionSecret()}:painel-signup-v1`)
    .update(encoded)
    .digest("base64url")
  return `${encoded}.${sig}`
}

export function verifyPainelSignupSession(token: string | null | undefined): PainelSignupSessionPayload | null {
  if (!token) return null
  const [encoded, sig] = token.split(".")
  if (!encoded || !sig) return null
  const expected = createHmac("sha256", `${sessionSecret()}:painel-signup-v1`)
    .update(encoded)
    .digest("base64url")
  try {
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expected)
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<PainelSignupSessionPayload>
    if (
      typeof parsed.e !== "string" ||
      typeof parsed.t !== "string" ||
      typeof parsed.x !== "number"
    )
      return null
    return { e: parsed.e, t: parsed.t, x: parsed.x }
  } catch {
    return null
  }
}

/** maxAgeSeconds default 48 min (buffer sobre o TTL do token no BD) */
export function appendPainelSignupCookie(
  res: NextResponse,
  payload: PainelSignupSessionPayload,
  maxAgeSeconds = 48 * 60
) {
  res.cookies.set(PAINEL_SIGNUP_COOKIE, signPainelSignupSession(payload), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  })
}

export async function clearPainelSignupCookieStore() {
  try {
    const store = await cookies()
    store.set(PAINEL_SIGNUP_COOKIE, "", { path: "/", maxAge: 0 })
  } catch {
    /* fora de request */
  }
}
