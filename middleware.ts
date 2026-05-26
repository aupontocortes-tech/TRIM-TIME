import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Evita que o browser (ou proxy) sirva HTML antigo do painel após novo deploy na Vercel.
 * Não altera layout; só cabeçalhos de cache.
 */
export function middleware(request: NextRequest) {
  const res = NextResponse.next()
  res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate")
  return res
}

export const config = {
  matcher: ["/painel/:path*"],
}
