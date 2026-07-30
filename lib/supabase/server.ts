import { createServerClient } from "@supabase/ssr"
import type { CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore em Server Components
          }
        },
      },
    }
  )
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { getSupabaseServiceConfig } from "@/lib/supabase/service-config"

/**
 * Anon, sem cookies — para signInWithOtp / verifyOtp em API routes.
 * O GoTrue valida o OTP no mesmo fluxo do client público; com service_role a verificação
 * costuma retornar “token inválido ou expirado” mesmo com código certo.
 */
export function createAnonServerAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
    )
  }
  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "implicit",
    },
  })
}

/** Cliente com service_role para API routes (backend-only). Nunca exponha no cliente. */
export function createServiceRoleClient() {
  const cfg = getSupabaseServiceConfig()
  if (!cfg.ok) {
    throw new Error(cfg.hint ? `${cfg.error}\n\n${cfg.hint}` : cfg.error)
  }
  return createSupabaseClient(cfg.url, cfg.key, { auth: { persistSession: false } })
}
