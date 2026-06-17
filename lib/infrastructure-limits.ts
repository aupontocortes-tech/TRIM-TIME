/** Limites de referência dos planos FREE (ajustáveis por env). */

export type InfraStatus = "ok" | "warn" | "critical" | "unknown"

export type InfraMetric = {
  id: string
  label: string
  description: string
  used: number
  limit: number
  unit: string
  percent: number | null
  status: InfraStatus
  hint: string
  source: "database" | "estimate" | "env" | "api"
}

export type InfraLimitsConfig = {
  resendEmailsMonth: number
  resendDailyEmails: number
  supabaseMauMonth: number
  supabaseDbMb: number
  supabaseStorageMb: number
  vercelInvocationsMonth: number
  otpMonthlyReference: number
  warnPercent: number
  criticalPercent: number
}

export function getInfraLimitsConfig(): InfraLimitsConfig {
  const num = (key: string, fallback: number) => {
    const v = process.env[key]?.trim()
    if (!v) return fallback
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }
  return {
    resendEmailsMonth: num("INFRA_LIMIT_RESEND_EMAILS", 3000),
    resendDailyEmails: num("INFRA_LIMIT_RESEND_DAILY", 100),
    supabaseMauMonth: num("INFRA_LIMIT_SUPABASE_MAU", 50_000),
    supabaseDbMb: num("INFRA_LIMIT_SUPABASE_DB_MB", 500),
    supabaseStorageMb: num("INFRA_LIMIT_SUPABASE_STORAGE_MB", 1024),
    vercelInvocationsMonth: num("INFRA_LIMIT_VERCEL_INVOCATIONS", 1_000_000),
    otpMonthlyReference: num("INFRA_OTP_MONTHLY_REFERENCE", 2300),
    warnPercent: num("INFRA_WARN_PERCENT", 70),
    criticalPercent: num("INFRA_CRITICAL_PERCENT", 90),
  }
}

export function computeInfraStatus(
  percent: number | null,
  limits: Pick<InfraLimitsConfig, "warnPercent" | "criticalPercent">
): InfraStatus {
  if (percent === null || !Number.isFinite(percent)) return "unknown"
  if (percent >= limits.criticalPercent) return "critical"
  if (percent >= limits.warnPercent) return "warn"
  return "ok"
}

export function percentOf(used: number, limit: number): number | null {
  if (limit <= 0) return null
  return Math.min(999, Math.round((used / limit) * 1000) / 10)
}

export function statusLabel(status: InfraStatus): string {
  switch (status) {
    case "ok":
      return "Tranquilo"
    case "warn":
      return "Atenção"
    case "critical":
      return "No limite"
    default:
      return "Indisponível"
  }
}
