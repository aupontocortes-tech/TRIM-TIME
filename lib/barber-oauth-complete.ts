import { prisma } from "@/lib/prisma"
import { findBarberByPortalToken, isValidPortalToken } from "@/lib/barber-portal-resolve"
import { signBarberPortalSession, barberPortalCookieName } from "@/lib/barber-portal-session"
import type { NextResponse } from "next/server"

export type BarberPortalGoogleResult =
  | { ok: true; barberId: string; barbershopId: string; barberName: string; shopName: string }
  | { ok: false; error: string; code: "invalid_link" | "not_found" | "email_mismatch" | "suspended" }

export async function completeBarberPortalGoogleLogin(input: {
  portalToken: string
  email: string
  authUserId: string
}): Promise<BarberPortalGoogleResult> {
  const portalToken = String(input.portalToken ?? "").trim()
  const email = input.email.trim().toLowerCase()
  const authUserId = input.authUserId.trim()

  if (!isValidPortalToken(portalToken)) {
    return { ok: false, code: "invalid_link", error: "Link inválido." }
  }
  if (!email || !authUserId) {
    return { ok: false, code: "invalid_link", error: "Sessão do Google inválida." }
  }

  const barber = await findBarberByPortalToken(portalToken)
  if (!barber || barber.barbershop.suspendedAt) {
    return { ok: false, code: "not_found", error: "Profissional não encontrado." }
  }

  const barberEmail = (barber.email ?? "").trim().toLowerCase()
  if (!barberEmail || barberEmail !== email) {
    return {
      ok: false,
      code: "email_mismatch",
      error: "Este Gmail não confere com o e-mail cadastrado neste link. Use o mesmo e-mail do cadastro ou entre com código OTP.",
    }
  }

  await prisma.barber.update({
    where: { id: barber.id },
    data: { authUserId },
  })

  return {
    ok: true,
    barberId: barber.id,
    barbershopId: barber.barbershopId,
    barberName: barber.name,
    shopName: barber.barbershop.name,
  }
}

export function appendBarberPortalSessionCookie(
  res: NextResponse,
  input: { barberId: string; barbershopId: string; portalToken: string }
) {
  const cookieVal = signBarberPortalSession({
    barberId: input.barberId,
    barbershopId: input.barbershopId,
    portalToken: input.portalToken,
  })
  res.cookies.set(barberPortalCookieName(), cookieVal, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}
