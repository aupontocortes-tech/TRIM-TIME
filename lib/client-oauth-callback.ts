import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { completeClientOAuthBySlug } from "@/lib/client-oauth-complete"
import { publicClientCookieName, signPublicClientSession } from "@/lib/public-client-session"

export type ClientOAuthCallbackMode = "login" | "register"

export function appendClientSessionCookie(res: NextResponse, slug: string, clientId: string) {
  res.cookies.set(publicClientCookieName(slug), signPublicClientSession({ clientId, slug }), {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export function copyResponseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((c) => {
    to.cookies.set(c.name, c.value)
  })
}

/** Define para onde redirecionar e se deve gravar cookie do cliente (após exchangeCodeForSession). */
export async function resolveClientOAuthRedirect(
  supabase: SupabaseClient,
  origin: string,
  slug: string,
  mode: ClientOAuthCallbackMode,
  profile?: { nome?: string; telefone?: string }
): Promise<{ url: URL; clientId?: string }> {
  const barbershopPath = `/b/${encodeURIComponent(slug)}`
  const base = new URL(barbershopPath, origin)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.email) {
    base.searchParams.set("client_oauth_error", "session")
    return { url: base }
  }

  const result = await completeClientOAuthBySlug(slug, {
    email: user.email,
    mode,
    nome: profile?.nome,
    telefone: profile?.telefone,
  })

  if (!result.ok) {
    if (result.code === "shop_not_found") {
      return { url: new URL("/", origin) }
    }
    if (result.code === "incomplete_register") {
      base.searchParams.set("oauth_need_profile", "1")
      base.searchParams.set("email", user.email.trim())
      return { url: base }
    }
    const errCode =
      result.code === "not_registered"
        ? "not_registered"
        : result.code === "phone_conflict"
          ? "phone_conflict"
          : "failed"
    base.searchParams.set("client_oauth_error", errCode)
    base.searchParams.set("oauth_error_msg", result.error.slice(0, 200))
    return { url: base }
  }

  return { url: base, clientId: result.client.id }
}
