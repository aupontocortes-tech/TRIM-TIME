import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { handlePainelOAuthCallback, type PainelOAuthFlow } from "@/lib/painel-oauth"
import { appendClientSessionCookie, resolveClientOAuthRedirect } from "@/lib/client-oauth-callback"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin
  const flowParam = url.searchParams.get("flow")

  if (url.searchParams.get("error")) {
    if (flowParam === "client") {
      const slug = url.searchParams.get("slug")?.trim()
      if (slug) {
        const back = new URL(`/b/${encodeURIComponent(slug)}`, origin)
        back.searchParams.set("client_oauth_error", "denied")
        return NextResponse.redirect(back)
      }
    }
    return NextResponse.redirect(`${origin}/login?error=oauth_denied`)
  }

  const code = url.searchParams.get("code")
  if (!code) {
    if (flowParam === "client") {
      const slug = url.searchParams.get("slug")?.trim()
      if (slug) {
        const back = new URL(`/b/${encodeURIComponent(slug)}`, origin)
        back.searchParams.set("client_oauth_error", "missing_code")
        return NextResponse.redirect(back)
      }
    }
    return NextResponse.redirect(`${origin}/login?error=oauth_missing_code`)
  }

  const supabase = await createClient()
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeErr) {
    console.warn("[oauth] exchangeCodeForSession:", exchangeErr.message)
    if (flowParam === "client") {
      const slug = url.searchParams.get("slug")?.trim()
      if (slug) {
        const back = new URL(`/b/${encodeURIComponent(slug)}`, origin)
        back.searchParams.set("client_oauth_error", "failed")
        return NextResponse.redirect(back)
      }
    }
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
  }

  if (flowParam === "client") {
    const slug = url.searchParams.get("slug")?.trim()
    const mode = url.searchParams.get("mode") === "register" ? "register" : "login"
    const nome = url.searchParams.get("nome")?.trim() || undefined
    const telefone = url.searchParams.get("telefone")?.trim() || undefined

    if (!slug) {
      return NextResponse.redirect(`${origin}/?error=oauth_slug`)
    }

    const { url: target, clientId } = await resolveClientOAuthRedirect(supabase, origin, slug, mode, {
      nome,
      telefone,
    })
    const response = NextResponse.redirect(target)
    if (clientId) {
      appendClientSessionCookie(response, slug, clientId)
    }
    return response
  }

  const flow: PainelOAuthFlow = flowParam === "signup" ? "signup" : "login"
  return handlePainelOAuthCallback(request.url, flow)
}
