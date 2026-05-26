import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { BARBERSHOP_ID_COOKIE } from "@/lib/tenant"
import { conflictForBarbershopSignup } from "@/lib/barbershop-signup-conflicts"
import { createPainelSignupTokenForEmail } from "@/lib/painel-signup-otp"
import { canonicalSignupEmail, normalizeSignupEmail } from "@/lib/signup-identity"
import { createClient } from "@/lib/supabase/server"
import { appendPainelSignupCookie } from "@/lib/painel-signup-session-cookie"

export type PainelOAuthFlow = "login" | "signup"

function redirect(origin: string, path: string, params?: Record<string, string>) {
  const url = new URL(path, origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v)
    }
  }
  return NextResponse.redirect(url)
}

export async function handlePainelOAuthCallback(
  requestUrl: string,
  flow: PainelOAuthFlow
): Promise<NextResponse> {
  const { origin } = new URL(requestUrl)
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.email) {
    return redirect(origin, "/login", { error: "oauth_session" })
  }

  const emailCanon = canonicalSignupEmail(normalizeSignupEmail(user.email))
  const emailDisplay = user.email.trim()

  const barbershop = await prisma.barbershop.findFirst({
    where: { email: emailCanon },
    select: { id: true, suspendedAt: true },
  })

  if (flow === "login") {
    if (!barbershop) {
      return redirect(origin, "/cadastro", {
        tipo: "barbearia",
        email: emailDisplay,
        hint: "no_account",
      })
    }
    if (barbershop.suspendedAt) {
      return redirect(origin, "/login", { error: "suspended" })
    }
    const res = redirect(origin, "/dashboard-barbearia")
    res.cookies.set(BARBERSHOP_ID_COOKIE, barbershop.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
    return res
  }

  if (barbershop) {
    return redirect(origin, "/login", { error: "account_exists" })
  }

  const conflict = await conflictForBarbershopSignup(prisma, { email: emailCanon, phone: null })
  if (conflict === "email") {
    return redirect(origin, "/login", { error: "account_exists" })
  }

  const tokenResult = await createPainelSignupTokenForEmail(user.email)
  if ("error" in tokenResult) {
    return redirect(origin, "/cadastro", {
      tipo: "barbearia",
      error: tokenResult.error.slice(0, 120),
    })
  }

  const res = redirect(origin, "/cadastro", {
    tipo: "barbearia",
    oauth: "1",
    email: emailDisplay,
  })
  appendPainelSignupCookie(res, {
    e: tokenResult.email_canonical,
    t: tokenResult.signup_token,
    x: new Date(tokenResult.expires_at).getTime(),
  })
  return res
}
