function isLocalDevOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
}

/** Domínio público do link de agendamento (/b/:slug). */
export function resolvePublicBookingOrigin(runtimeOrigin = ""): string {
  const runtime = runtimeOrigin.trim().replace(/\/$/, "")
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "")

  // No painel em trimtime.pro, não forçar localhost só porque o .env local ficou na Vercel.
  if (runtime && !isLocalDevOrigin(runtime)) return runtime
  if (fromEnv && !isLocalDevOrigin(fromEnv)) return fromEnv

  const vercel = process.env.VERCEL_URL?.trim().replace(/^https?:\/\//, "")
  if (vercel) return `https://${vercel}`

  if (fromEnv) return fromEnv
  return runtime
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
