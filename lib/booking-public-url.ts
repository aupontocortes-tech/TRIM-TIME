/** Domínio público do link de agendamento (/b/:slug) — prioriza NEXT_PUBLIC_APP_URL na Vercel. */
export function resolvePublicBookingOrigin(runtimeOrigin = ""): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "")
  if (fromEnv) return fromEnv
  return runtimeOrigin.trim().replace(/\/$/, "")
}

export function publicBookingPath(slug: string): string {
  const s = slug.trim()
  return s ? `/b/${encodeURIComponent(s)}` : ""
}

export function publicBookingUrl(slug: string, runtimeOrigin = ""): string {
  const path = publicBookingPath(slug)
  if (!path) return ""
  const origin = resolvePublicBookingOrigin(runtimeOrigin)
  return origin ? `${origin}${path}` : path
}
