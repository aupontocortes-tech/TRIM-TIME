import { NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler"
import {
  appendBarberPortalSessionCookie,
  completeBarberPortalGoogleLogin,
} from "@/lib/barber-oauth-complete"
import {
  appendBarberInviteGoogleCookie,
} from "@/lib/barber-invite-google-cookie"
import {
  clearBarberOAuthPendingOnResponse,
  readBarberOAuthPendingFromRequest,
} from "@/lib/barber-oauth-pending-cookie"
import { isValidPortalToken } from "@/lib/barber-portal-resolve"

function portalErrorRedirect(origin: string, portalToken: string, code: string, msg?: string) {
  const back = new URL(`/profissional/${encodeURIComponent(portalToken)}`, origin)
  back.searchParams.set("barber_oauth_error", code)
  if (msg) back.searchParams.set("oauth_error_msg", msg.slice(0, 220))
  return back
}

function inviteErrorRedirect(origin: string, inviteToken: string, code: string, msg?: string) {
  const back = new URL(`/convite/barbeiro/${encodeURIComponent(inviteToken)}`, origin)
  back.searchParams.set("barber_oauth_error", code)
  if (msg) back.searchParams.set("oauth_error_msg", msg.slice(0, 220))
  return back
}

export async function handleBarberOAuthCallbackGet(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url)
  const origin = url.origin
  const pending = await readBarberOAuthPendingFromRequest(request)

  if (!pending) {
    const fallback = new URL("/", origin)
    fallback.searchParams.set("error", "oauth_barber")
    fallback.searchParams.set("oauth_msg", "Sessão do Google expirou. Tente de novo.")
    return NextResponse.redirect(fallback)
  }

  const portalToken = pending.portalToken ?? ""
  const inviteToken = pending.inviteToken ?? ""

  if (url.searchParams.get("error")) {
    const target =
      pending.flow === "invite_register" && inviteToken
        ? inviteErrorRedirect(origin, inviteToken, "denied")
        : portalToken
          ? portalErrorRedirect(origin, portalToken, "denied")
          : new URL("/", origin)
    const res = NextResponse.redirect(target)
    clearBarberOAuthPendingOnResponse(res)
    return res
  }

  const code = url.searchParams.get("code")
  if (!code) {
    const target =
      pending.flow === "invite_register" && inviteToken
        ? inviteErrorRedirect(origin, inviteToken, "missing_code")
        : portalToken
          ? portalErrorRedirect(origin, portalToken, "missing_code")
          : new URL("/", origin)
    const res = NextResponse.redirect(target)
    clearBarberOAuthPendingOnResponse(res)
    return res
  }

  const failTarget =
    pending.flow === "invite_register" && inviteToken
      ? inviteErrorRedirect(origin, inviteToken, "pending")
      : portalToken
        ? portalErrorRedirect(origin, portalToken, "pending")
        : new URL("/", origin)

  const holder = NextResponse.redirect(failTarget)
  const supabase = createSupabaseRouteHandlerClient(request, holder)
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeErr) {
    console.warn("[oauth barber] exchange:", exchangeErr.message)
    const hint =
      exchangeErr.message.toLowerCase().includes("redirect") ||
      exchangeErr.message.toLowerCase().includes("url")
        ? "Confira em Supabase → Redirect URLs: https://SEU-DOMINIO/auth/callback/barber"
        : exchangeErr.message
    const errUrl =
      pending.flow === "invite_register" && inviteToken
        ? inviteErrorRedirect(origin, inviteToken, "failed", hint)
        : portalToken
          ? portalErrorRedirect(origin, portalToken, "failed", hint)
          : new URL("/", origin)
    const res = NextResponse.redirect(errUrl)
    holder.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value))
    clearBarberOAuthPendingOnResponse(res)
    return res
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ""
  const authUserId = user?.id ?? ""

  if (!email || !authUserId) {
    const res = NextResponse.redirect(
      pending.flow === "invite_register" && inviteToken
        ? inviteErrorRedirect(origin, inviteToken, "no_email")
        : portalToken
          ? portalErrorRedirect(origin, portalToken, "no_email")
          : new URL("/", origin)
    )
    holder.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value))
    clearBarberOAuthPendingOnResponse(res)
    return res
  }

  if (pending.flow === "invite_register") {
    if (!inviteToken || inviteToken.length < 32) {
      const res = NextResponse.redirect(new URL("/", origin))
      clearBarberOAuthPendingOnResponse(res)
      return res
    }
    const success = new URL(`/convite/barbeiro/${encodeURIComponent(inviteToken)}`, origin)
    success.searchParams.set("google", "1")
    const res = NextResponse.redirect(success)
    holder.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value))
    clearBarberOAuthPendingOnResponse(res)
    appendBarberInviteGoogleCookie(res, { inviteToken, email, authUserId })
    return res
  }

  if (!portalToken || !isValidPortalToken(portalToken)) {
    const res = NextResponse.redirect(new URL("/", origin))
    clearBarberOAuthPendingOnResponse(res)
    return res
  }

  const result = await completeBarberPortalGoogleLogin({ portalToken, email, authUserId })
  if (!result.ok) {
    const res = NextResponse.redirect(
      portalErrorRedirect(origin, portalToken, result.code, result.error)
    )
    holder.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value))
    clearBarberOAuthPendingOnResponse(res)
    return res
  }

  const success = new URL(`/profissional/${encodeURIComponent(portalToken)}`, origin)
  success.searchParams.set("google", "1")
  const res = NextResponse.redirect(success)
  holder.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value))
  clearBarberOAuthPendingOnResponse(res)
  appendBarberPortalSessionCookie(res, {
    barberId: result.barberId,
    barbershopId: result.barbershopId,
    portalToken,
  })
  return res
}
