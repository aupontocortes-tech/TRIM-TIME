import { createHmac, timingSafeEqual } from "node:crypto"

const COOKIE_NAME = "trimtime_barber_portal"

function sessionSecret() {
  return `${process.env.SUPABASE_SERVICE_ROLE_KEY || "trimtime-dev-client-session-secret"}:barber-portal-v1`
}

export function barberPortalCookieName() {
  return COOKIE_NAME
}

type Payload = { barberId: string; barbershopId: string; portalToken: string }

export function signBarberPortalSession(payload: Payload) {
  const raw = JSON.stringify(payload)
  const encoded = Buffer.from(raw, "utf8").toString("base64url")
  const sig = createHmac("sha256", sessionSecret()).update(encoded).digest("base64url")
  return `${encoded}.${sig}`
}

export function verifyBarberPortalSession(
  portalToken: string,
  token: string | null | undefined
): Payload | null {
  if (!token) return null
  const [encoded, sig] = token.split(".")
  if (!encoded || !sig) return null
  const expected = createHmac("sha256", sessionSecret()).update(encoded).digest("base64url")
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<Payload>
    if (!parsed?.barberId || !parsed?.barbershopId || parsed.portalToken !== portalToken) return null
    return {
      barberId: parsed.barberId,
      barbershopId: parsed.barbershopId,
      portalToken: parsed.portalToken,
    }
  } catch {
    return null
  }
}
