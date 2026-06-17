export type ResendQuotaSnapshot = {
  monthlyUsed: number
  dailyUsed: number | null
  source: "api"
}

/** Lê cota usada nos headers da API Resend (GET /emails). */
export async function fetchResendQuota(): Promise<ResendQuotaSnapshot | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return null

  try {
    const res = await fetch("https://api.resend.com/emails?limit=1", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    })
    if (!res.ok) return null

    const monthlyRaw = res.headers.get("x-resend-monthly-quota")
    const monthlyUsed = monthlyRaw != null ? Number(monthlyRaw) : NaN
    if (!Number.isFinite(monthlyUsed) || monthlyUsed < 0) return null

    const dailyRaw = res.headers.get("x-resend-daily-quota")
    const dailyParsed = dailyRaw != null ? Number(dailyRaw) : NaN
    const dailyUsed = Number.isFinite(dailyParsed) && dailyParsed >= 0 ? dailyParsed : null

    return { monthlyUsed, dailyUsed, source: "api" }
  } catch {
    return null
  }
}
