import { createServerClient } from "@supabase/ssr"
import type { CookieOptions } from "@supabase/ssr"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Cliente Supabase para Route Handlers: grava cookies de sessão na resposta do redirect.
 * Necessário para OAuth — cookies só em `cookies()` do Next nem sempre vão no redirect.
 */
export function createSupabaseRouteHandlerClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )
}
