import { createHmac, timingSafeEqual } from "node:crypto"
import { publicBookingUrl } from "@/lib/booking-public-url"

function secret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "trimtime-dev-waitlist-confirm-secret"
}

export function signWaitlistConfirmToken(payload: { itemId: string; slug: string }) {
  const raw = JSON.stringify(payload)
  const encoded = Buffer.from(raw, "utf8").toString("base64url")
  const sig = createHmac("sha256", secret()).update(encoded).digest("base64url")
  return `${encoded}.${sig}`
}

export function verifyWaitlistConfirmToken(
  slug: string,
  token: string | null | undefined
): { itemId: string; slug: string } | null {
  if (!token) return null
  const [encoded, sig] = token.split(".")
  if (!encoded || !sig) return null
  const expected = createHmac("sha256", secret()).update(encoded).digest("base64url")
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      itemId?: string
      slug?: string
    }
    if (!parsed?.itemId || parsed.slug !== slug) return null
    return { itemId: parsed.itemId, slug: parsed.slug }
  } catch {
    return null
  }
}

export function buildWaitlistConfirmUrl(slug: string, itemId: string): string {
  const token = signWaitlistConfirmToken({ itemId, slug })
  const base = publicBookingUrl(slug)
  return `${base}?wl_confirm=${encodeURIComponent(token)}`
}
