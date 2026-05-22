import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler"
import { handlePainelOAuthCallback, type PainelOAuthFlow } from "@/lib/painel-oauth"
import {
  appendClientSessionCookie,
  resolveClientOAuthRedirect,
} from "@/lib/client-oauth-callback"
import {
  clearClientOAuthPendingOnResponse,
  readClientOAuthPendingFromRequest,
} from "@/lib/client-oauth-pending-cookie"

export const dynamic = "force-dynamic"

function clientErrorRedirect(origin: string, slug: string, code: string, msg?: string) {
  const back = new URL(`/b/${encodeURIComponent(slug)}`, origin)
  back.searchParams.set("client_oauth_error", code)
  if (msg) back.searchParams.set("oauth_error_msg", msg.slice(0, 220))
  return back
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const origin = url.origin
  const flowParam = url.searchParams.get("flow")
  const pending = await readClientOAuthPendingFromRequest(request)

  const clientSlug = url.searchParams.get("slug")?.trim() || pending?.slug || ""

  if (url.searchParams.get("error")) {
    if (flowParam === "client" && clientSlug) {
      const res = NextResponse.redirect(clientErrorRedirect(origin, clientSlug, "denied"))
      clearClientOAuthPendingOnResponse(res)
      return res
    }
    return NextResponse.redirect(`${origin}/login?error=oauth_denied`)
  }

  const code = url.searchParams.get("code")
  if (!code) {
    if (flowParam === "client" && clientSlug) {
      const res = NextResponse.redirect(clientErrorRedirect(origin, clientSlug, "missing_code"))
      clearClientOAuthPendingOnResponse(res)
      return res
    }
    return NextResponse.redirect(`${origin}/login?error=oauth_missing_code`)
  }

  if (flowParam === "client") {
    if (!clientSlug) {
      return NextResponse.redirect(`${origin}/?error=oauth_slug`)
    }

    const mode =
      url.searchParams.get("mode") === "register"
        ? "register"
        : pending?.mode === "register"
          ? "register"
          : "login"
    const nome = url.searchParams.get("nome")?.trim() || pending?.nome
    const telefone = url.searchParams.get("telefone")?.trim() || pending?.telefone

    const holder = NextResponse.redirect(clientErrorRedirect(origin, clientSlug, "pending"))
    const supabase = createSupabaseRouteHandlerClient(request, holder)
    const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeErr) {
      console.warn("[oauth client] exchange:", exchangeErr.message)
      const hint =
        exchangeErr.message.toLowerCase().includes("redirect") ||
        exchangeErr.message.toLowerCase().includes("url")
          ? "Confira em Supabase → URL Configuration se existe https://trimtime.pro/auth/callback (ou /**)."
          : exchangeErr.message
      const failUrl = clientErrorRedirect(origin, clientSlug, "failed", hint)
      const res = NextResponse.redirect(failUrl)
      holder.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value))
      clearClientOAuthPendingOnResponse(res)
      return res
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const sessionFallback = user?.email ? user : (await supabase.auth.getSession()).data.session?.user

    const { url: target, clientId } = await resolveClientOAuthRedirect(
      origin,
      clientSlug,
      mode,
      sessionFallback,
      { nome, telefone }
    )
    const response = NextResponse.redirect(target)
    holder.cookies.getAll().forEach((c) => response.cookies.set(c.name, c.value))
    clearClientOAuthPendingOnResponse(response)
    if (clientId) {
      appendClientSessionCookie(response, clientSlug, clientId)
    }
    return response
  }

  const supabase = await createClient()
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeErr) {
    console.warn("[oauth painel] exchange:", exchangeErr.message)
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
  }

  const flow: PainelOAuthFlow = flowParam === "signup" ? "signup" : "login"
  return handlePainelOAuthCallback(request.url, flow)
}
