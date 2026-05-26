import { createHmac, timingSafeEqual } from "node:crypto"

const COOKIE_PREFIX = "trimtime_client_session_"

function sessionSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "trimtime-dev-client-session-secret"
}

export function publicClientCookieName(slug: string) {
  return `${COOKIE_PREFIX}${slug}`
}

export function signPublicClientSession(payload: { clientId: string; slug: string }) {
  const raw = JSON.stringify(payload)
  const encoded = Buffer.from(raw, "utf8").toString("base64url")
  const sig = createHmac("sha256", sessionSecret()).update(encoded).digest("base64url")
  return `${encoded}.${sig}`
}

export function verifyPublicClientSession(
  slug: string,
  token: string | null | undefined
): { clientId: string; slug: string } | null {
  if (!token) return null
  const [encoded, sig] = token.split(".")
  if (!encoded || !sig) return null
  const expected = createHmac("sha256", sessionSecret()).update(encoded).digest("base64url")
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      clientId?: string
      slug?: string
    }
    if (!parsed?.clientId || parsed.slug !== slug) return null
    return { clientId: parsed.clientId, slug: parsed.slug }
  } catch {
    return null
  }
}
