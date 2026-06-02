import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"

export const BARBER_INVITE_GOOGLE_COOKIE = "trimtime_barber_invite_google"

export type BarberInviteGooglePayload = {
  inviteToken: string
  email: string
  authUserId: string
  exp: number
}

function secret() {
  return (
    process.env.BARBER_INVITE_GOOGLE_SECRET?.trim() ||
    process.env.BARBER_OAUTH_PENDING_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "trimtime-dev-barber-invite-google"
  )
}

export function signBarberInviteGoogle(payload: BarberInviteGooglePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const sig = createHmac("sha256", `${secret()}:barber-invite-google-v1`).update(encoded).digest("base64url")
  return `${encoded}.${sig}`
}

export function verifyBarberInviteGoogle(token: string | null | undefined): BarberInviteGooglePayload | null {
  if (!token) return null
  const [encoded, sig] = token.split(".")
  if (!encoded || !sig) return null
  const expected = createHmac("sha256", `${secret()}:barber-invite-google-v1`).update(encoded).digest("base64url")
  try {
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expected)
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<BarberInviteGooglePayload>
    if (typeof parsed.inviteToken !== "string" || typeof parsed.email !== "string") return null
    if (typeof parsed.authUserId !== "string" || typeof parsed.exp !== "number" || parsed.exp <= Date.now()) return null
    return {
      inviteToken: parsed.inviteToken.trim(),
      email: parsed.email.trim().toLowerCase(),
      authUserId: parsed.authUserId.trim(),
      exp: parsed.exp,
    }
  } catch {
    return null
  }
}

export function appendBarberInviteGoogleCookie(
  res: NextResponse,
  payload: Omit<BarberInviteGooglePayload, "exp"> & { ttlSeconds?: number }
) {
  const exp = Date.now() + (payload.ttlSeconds ?? 3600) * 1000
  res.cookies.set(
    BARBER_INVITE_GOOGLE_COOKIE,
    signBarberInviteGoogle({
      inviteToken: payload.inviteToken,
      email: payload.email.trim().toLowerCase(),
      authUserId: payload.authUserId,
      exp,
    }),
    {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: payload.ttlSeconds ?? 3600,
    }
  )
}

export async function readBarberInviteGoogleFromRequest(request: Request): Promise<BarberInviteGooglePayload | null> {
  const header = request.headers.get("cookie") ?? ""
  const match = header.match(new RegExp(`${BARBER_INVITE_GOOGLE_COOKIE}=([^;]+)`))
  return verifyBarberInviteGoogle(match?.[1] ? decodeURIComponent(match[1]) : null)
}

export async function readBarberInviteGoogleFromStore(): Promise<BarberInviteGooglePayload | null> {
  try {
    const store = await cookies()
    return verifyBarberInviteGoogle(store.get(BARBER_INVITE_GOOGLE_COOKIE)?.value ?? null)
  } catch {
    return null
  }
}

export function clearBarberInviteGoogleOnResponse(res: NextResponse) {
  res.cookies.set(BARBER_INVITE_GOOGLE_COOKIE, "", { path: "/", maxAge: 0 })
}
