import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { handlePainelOAuthCallback, type PainelOAuthFlow } from "@/lib/painel-oauth"
import { handleClientOAuthCallbackGet } from "@/lib/auth/client-oauth-callback-handler"
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

  if (flowParam === "client" && clientSlug) {
    const mode =
      url.searchParams.get("mode") === "register"
        ? "register"
        : pending?.mode === "register"
          ? "register"
          : "login"
    return handleClientOAuthCallbackGet(request, clientSlug, mode)
  }

  if (flowParam === "client" && !clientSlug) {
    const fallback = new URL("/", origin)
    fallback.searchParams.set("error", "oauth_slug")
    fallback.searchParams.set(
      "oauth_msg",
      "Não foi possível identificar a barbearia após o Google. Abra de novo o link de agendamento que você recebeu e tente outra vez."
    )
    return NextResponse.redirect(fallback)
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
