import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { handlePainelOAuthCallback, type PainelOAuthFlow } from "@/lib/painel-oauth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin

  if (url.searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?error=oauth_denied`)
  }

  const code = url.searchParams.get("code")
  const flowParam = url.searchParams.get("flow")

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
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.warn("[oauth] exchangeCodeForSession:", error.message)
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
    if (!slug) {
      return NextResponse.redirect(`${origin}/?error=oauth_slug`)
    }
    const back = new URL(`/b/${encodeURIComponent(slug)}`, origin)
    back.searchParams.set("client_oauth", "1")
    back.searchParams.set("mode", mode)
    return NextResponse.redirect(back)
  }

  const flow: PainelOAuthFlow = flowParam === "signup" ? "signup" : "login"
  return handlePainelOAuthCallback(request.url, flow)
}
