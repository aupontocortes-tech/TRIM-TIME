import { isAsaasConfigured } from "@/lib/asaas/config"
import {
  computeInfraStatus,
  getInfraLimitsConfig,
  percentOf,
  type InfraMetric,
  type InfraStatus,
} from "@/lib/infrastructure-limits"
import { prisma } from "@/lib/prisma"
import { REAL_BARBERSHOP_WHERE, REAL_SUBSCRIPTION_WHERE } from "@/lib/tenant-metrics"

function monthStartUtc(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

async function countOtpSendsSince(since: Date): Promise<{
  painelSignup: number
  clientPortal: number
  barberPortal: number
}> {
  const [painelSignup, clientPortal, barberPortal] = await Promise.all([
    prisma.painelSignupOtpSend.count({ where: { createdAt: { gte: since } } }),
    prisma.clientOtpCode.count({ where: { createdAt: { gte: since } } }),
    prisma.barberOtpCode.count({ where: { createdAt: { gte: since } } }),
  ])
  return { painelSignup, clientPortal, barberPortal }
}

async function databaseSizeMb(): Promise<number | null> {
  try {
    const rows = await prisma.$queryRaw<{ size_mb: number }[]>`
      SELECT ROUND((pg_database_size(current_database()) / 1024.0 / 1024.0)::numeric, 1)::float AS size_mb
    `
    const mb = rows[0]?.size_mb
    return typeof mb === "number" && Number.isFinite(mb) ? mb : null
  } catch {
    return null
  }
}

export type InfrastructureUsagePayload = {
  updated_at: string
  limits: ReturnType<typeof getInfraLimitsConfig>
  summary: { ok: number; warn: number; critical: number; unknown: number }
  metrics: InfraMetric[]
  business: {
    barbershops: number
    trial: number
    activePaid: number
    canceled: number
  }
  integrations: {
    resend_configured: boolean
    asaas_configured: boolean
    supabase_url_configured: boolean
  }
}

function buildMetric(input: {
  id: string
  label: string
  description: string
  used: number
  limit: number
  unit: string
  hint: string
  source: InfraMetric["source"]
  limits: ReturnType<typeof getInfraLimitsConfig>
}): InfraMetric {
  const percent = percentOf(input.used, input.limit)
  return {
    id: input.id,
    label: input.label,
    description: input.description,
    used: input.used,
    limit: input.limit,
    unit: input.unit,
    percent,
    status: computeInfraStatus(percent, input.limits),
    hint: input.hint,
    source: input.source,
  }
}

export async function getInfrastructureUsage(): Promise<InfrastructureUsagePayload> {
  const limits = getInfraLimitsConfig()
  const since = monthStartUtc()

  const [
    otpCounts,
    dbMb,
    barbershops,
    trial,
    activePaid,
    canceled,
  ] = await Promise.all([
    countOtpSendsSince(since),
    databaseSizeMb(),
    prisma.barbershop.count({ where: REAL_BARBERSHOP_WHERE }),
    prisma.subscription.count({
      where: { status: "trial", ...REAL_SUBSCRIPTION_WHERE },
    }),
    prisma.subscription.count({
      where: { status: "active", ...REAL_SUBSCRIPTION_WHERE },
    }),
    prisma.subscription.count({
      where: { status: "canceled", ...REAL_SUBSCRIPTION_WHERE },
    }),
  ])

  const resendProxyEmails = otpCounts.painelSignup + otpCounts.clientPortal
  const supabaseAuthProxy = otpCounts.painelSignup + otpCounts.clientPortal + otpCounts.barberPortal

  const metrics: InfraMetric[] = [
    buildMetric({
      id: "resend_otp_dono",
      label: "E-mails OTP — dono + cliente",
      description: "Cadastro /cadastro e agendamento /b/:slug (proxy do uso no Resend).",
      used: resendProxyEmails,
      limit: limits.resendEmailsMonth,
      unit: "e-mails",
      hint:
        resendProxyEmails >= limits.resendEmailsMonth * 0.7
          ? "Perto do teto free do Resend (~3.000/mês). Considere plano pago ou mais login com Google."
          : "Principal gargalo do FREE se muitos cadastros forem por e-mail + código.",
      source: "database",
      limits,
    }),
    buildMetric({
      id: "otp_cadastro_ref",
      label: "Cadastros OTP dono (referência)",
      description: `Com ~1,3 envio por cadastro, ~${limits.otpMonthlyReference} cadastros/mês ≈ teto Resend.`,
      used: resendProxyEmails,
      limit: limits.otpMonthlyReference,
      unit: "envios",
      hint: "Número de referência para planejar upgrade do Resend.",
      source: "estimate",
      limits,
    }),
    buildMetric({
      id: "supabase_mau_proxy",
      label: "Autenticações Supabase (estimativa)",
      description: "OTP dono + OTP cliente + OTP barbeiro neste mês (aproxima MAU).",
      used: supabaseAuthProxy,
      limit: limits.supabaseMauMonth,
      unit: "eventos",
      hint:
        "MAU real está no painel Supabase → Usage. Login do dono com senha não entra aqui.",
      source: "estimate",
      limits,
    }),
    buildMetric({
      id: "supabase_db",
      label: "Banco de dados (Postgres)",
      description: "Tamanho atual do banco no Supabase.",
      used: dbMb ?? 0,
      limit: limits.supabaseDbMb,
      unit: "MB",
      hint: dbMb === null ? "Não foi possível ler o tamanho do banco." : "Cresce com barbearias, agendamentos e arquivos.",
      source: "database",
      limits,
    }),
  ]

  if (dbMb === null) {
    metrics[metrics.length - 1]!.status = "unknown"
    metrics[metrics.length - 1]!.percent = null
  }

  const summary = metrics.reduce(
    (acc, m) => {
      acc[m.status] += 1
      return acc
    },
    { ok: 0, warn: 0, critical: 0, unknown: 0 } as Record<InfraStatus, number>
  )

  return {
    updated_at: new Date().toISOString(),
    limits,
    summary,
    metrics,
    business: {
      barbershops,
      trial,
      activePaid,
      canceled,
    },
    integrations: {
      resend_configured: !!process.env.RESEND_API_KEY?.trim(),
      asaas_configured: isAsaasConfigured(),
      supabase_url_configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    },
  }
}
