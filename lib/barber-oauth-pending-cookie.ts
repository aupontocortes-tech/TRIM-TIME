import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"

export const BARBER_OAUTH_PENDING_COOKIE = "trimtime_barber_oauth_pending"

export type BarberOAuthFlow = "portal_login" | "invite_register"

export type BarberOAuthPendingPayload = {
  flow: BarberOAuthFlow
  portalToken?: string
  inviteToken?: string
  exp: number
}

function secret() {
  return (
    process.env.BARBER_OAUTH_PENDING_SECRET?.trim() ||
    process.env.CLIENT_OAUTH_PENDING_SECRET?.trim() ||
    process.env.PAINEL_SIGNUP_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "trimtime-dev-barber-oauth-pending"
  )
}

export function signBarberOAuthPending(payload: BarberOAuthPendingPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const sig = createHmac("sha256", `${secret()}:barber-oauth-v1`).update(encoded).digest("base64url")
  return `${encoded}.${sig}`
}

export function verifyBarberOAuthPending(token: string | null | undefined): BarberOAuthPendingPayload | null {
  if (!token) return null
  const [encoded, sig] = token.split(".")
  if (!encoded || !sig) return null
  const expected = createHmac("sha256", `${secret()}:barber-oauth-v1`).update(encoded).digest("base64url")
  try {
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expected)
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<BarberOAuthPendingPayload>
    if (parsed.flow !== "portal_login" && parsed.flow !== "invite_register") return null
    if (typeof parsed.exp !== "number" || parsed.exp <= Date.now()) return null
    if (parsed.flow === "portal_login" && typeof parsed.portalToken !== "string") return null
    if (parsed.flow === "invite_register" && typeof parsed.inviteToken !== "string") return null
    return {
      flow: parsed.flow,
      portalToken: typeof parsed.portalToken === "string" ? parsed.portalToken.trim() : undefined,
      inviteToken: typeof parsed.inviteToken === "string" ? parsed.inviteToken.trim() : undefined,
      exp: parsed.exp,
    }
  } catch {
    return null
  }
}

export function appendBarberOAuthPendingCookie(
  res: NextResponse,
  payload: Omit<BarberOAuthPendingPayload, "exp"> & { ttlSeconds?: number }
) {
  const exp = Date.now() + (payload.ttlSeconds ?? 600) * 1000
  res.cookies.set(
    BARBER_OAUTH_PENDING_COOKIE,
    signBarberOAuthPending({
      flow: payload.flow,
      portalToken: payload.portalToken,
      inviteToken: payload.inviteToken,
      exp,
    }),
    {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: payload.ttlSeconds ?? 600,
    }
  )
}

export async function readBarberOAuthPendingFromRequest(request: Request): Promise<BarberOAuthPendingPayload | null> {
  const header = request.headers.get("cookie") ?? ""
  const match = header.match(new RegExp(`${BARBER_OAUTH_PENDING_COOKIE}=([^;]+)`))
  return verifyBarberOAuthPending(match?.[1] ? decodeURIComponent(match[1]) : null)
}

export function clearBarberOAuthPendingOnResponse(res: NextResponse) {
  res.cookies.set(BARBER_OAUTH_PENDING_COOKIE, "", { path: "/", maxAge: 0 })
}

export async function clearBarberOAuthPendingCookieStore() {
  try {
    const store = await cookies()
    store.set(BARBER_OAUTH_PENDING_COOKIE, "", { path: "/", maxAge: 0 })
  } catch {
    /* fora de request */
  }
}
