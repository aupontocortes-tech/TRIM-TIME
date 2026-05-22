import { NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler"
import {
  appendClientSessionCookie,
  resolveClientOAuthRedirect,
} from "@/lib/client-oauth-callback"
import {
  clearClientOAuthPendingOnResponse,
  readClientOAuthPendingFromRequest,
} from "@/lib/client-oauth-pending-cookie"

function clientErrorRedirect(origin: string, slug: string, code: string, msg?: string) {
  const back = new URL(`/b/${encodeURIComponent(slug)}`, origin)
  back.searchParams.set("client_oauth_error", code)
  if (msg) back.searchParams.set("oauth_error_msg", msg.slice(0, 220))
  return back
}

/**
 * OAuth Google do cliente — slug vem da rota (/auth/callback/client/[slug])
 * para não depender de query string na URL permitida no Supabase.
 */
export async function handleClientOAuthCallbackGet(
  request: NextRequest,
  slug: string,
  modeHint?: "login" | "register"
): Promise<NextResponse> {
  const url = new URL(request.url)
  const origin = url.origin
  const clientSlug = slug.trim()
  const pending = await readClientOAuthPendingFromRequest(request)

  if (!clientSlug) {
    const fallback = new URL("/", origin)
    fallback.searchParams.set("error", "oauth_slug")
    fallback.searchParams.set(
      "oauth_msg",
      "Link de agendamento inválido. Abra de novo o link que a barbearia enviou."
    )
    return NextResponse.redirect(fallback)
  }

  if (url.searchParams.get("error")) {
    const res = NextResponse.redirect(clientErrorRedirect(origin, clientSlug, "denied"))
    clearClientOAuthPendingOnResponse(res)
    return res
  }

  const code = url.searchParams.get("code")
  if (!code) {
    const res = NextResponse.redirect(clientErrorRedirect(origin, clientSlug, "missing_code"))
    clearClientOAuthPendingOnResponse(res)
    return res
  }

  const mode =
    modeHint ??
    (url.searchParams.get("mode") === "register"
      ? "register"
      : pending?.mode === "register"
        ? "register"
        : "login")
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
        ? "Confira em Supabase → Redirect URLs: https://SEU-DOMINIO/auth/callback/client/**"
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
