import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"

export const CLIENT_OAUTH_PENDING_COOKIE = "trimtime_client_oauth_pending"

export type ClientOAuthPendingPayload = {
  slug: string
  mode: "login" | "register"
  nome?: string
  telefone?: string
  exp: number
}

function secret() {
  return (
    process.env.CLIENT_OAUTH_PENDING_SECRET?.trim() ||
    process.env.PAINEL_SIGNUP_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "trimtime-dev-client-oauth-pending"
  )
}

export function signClientOAuthPending(payload: ClientOAuthPendingPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const sig = createHmac("sha256", `${secret()}:client-oauth-v1`).update(encoded).digest("base64url")
  return `${encoded}.${sig}`
}

export function verifyClientOAuthPending(token: string | null | undefined): ClientOAuthPendingPayload | null {
  if (!token) return null
  const [encoded, sig] = token.split(".")
  if (!encoded || !sig) return null
  const expected = createHmac("sha256", `${secret()}:client-oauth-v1`).update(encoded).digest("base64url")
  try {
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expected)
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<ClientOAuthPendingPayload>
    if (typeof parsed.slug !== "string" || (parsed.mode !== "login" && parsed.mode !== "register")) return null
    if (typeof parsed.exp !== "number" || parsed.exp <= Date.now()) return null
    return {
      slug: parsed.slug.trim(),
      mode: parsed.mode,
      nome: typeof parsed.nome === "string" ? parsed.nome : undefined,
      telefone: typeof parsed.telefone === "string" ? parsed.telefone : undefined,
      exp: parsed.exp,
    }
  } catch {
    return null
  }
}

export function appendClientOAuthPendingCookie(
  res: NextResponse,
  payload: Omit<ClientOAuthPendingPayload, "exp"> & { ttlSeconds?: number }
) {
  const exp = Date.now() + (payload.ttlSeconds ?? 600) * 1000
  res.cookies.set(
    CLIENT_OAUTH_PENDING_COOKIE,
    signClientOAuthPending({
      slug: payload.slug,
      mode: payload.mode,
      nome: payload.nome,
      telefone: payload.telefone,
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

export async function readClientOAuthPendingFromRequest(request: Request): Promise<ClientOAuthPendingPayload | null> {
  const header = request.headers.get("cookie") ?? ""
  const match = header.match(new RegExp(`${CLIENT_OAUTH_PENDING_COOKIE}=([^;]+)`))
  return verifyClientOAuthPending(match?.[1] ? decodeURIComponent(match[1]) : null)
}

export async function clearClientOAuthPendingCookieStore() {
  try {
    const store = await cookies()
    store.set(CLIENT_OAUTH_PENDING_COOKIE, "", { path: "/", maxAge: 0 })
  } catch {
    /* fora de request */
  }
}

export function clearClientOAuthPendingOnResponse(res: NextResponse) {
  res.cookies.set(CLIENT_OAUTH_PENDING_COOKIE, "", { path: "/", maxAge: 0 })
}
