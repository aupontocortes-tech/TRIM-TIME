import { isAsaasConfigured } from "@/lib/asaas/config"
import { countEmailChannelsThisMonth } from "@/lib/infrastructure-providers/email-channels"
import { fetchResendQuota } from "@/lib/infrastructure-providers/resend-quota"
import {
  fetchSupabaseAuthUsage,
  fetchSupabaseStorageUsage,
} from "@/lib/infrastructure-providers/supabase-usage"
import {
  fetchVercelInvocationsThisMonth,
  isVercelUsageConfigured,
} from "@/lib/infrastructure-providers/vercel-usage"
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

async function countOtpProxySince(since: Date): Promise<number> {
  const [painelSignup, clientPortal] = await Promise.all([
    prisma.painelSignupOtpSend.count({ where: { createdAt: { gte: since } } }),
    prisma.clientOtpCode.count({ where: { createdAt: { gte: since } } }),
  ])
  return painelSignup + clientPortal
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
    vercel_usage_configured: boolean
    resend_quota_source: "api" | "proxy" | "unavailable"
  }
  email_channels: {
    via_resend: number
    via_supabase: number
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
  forceStatus?: InfraStatus
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
    status: input.forceStatus ?? computeInfraStatus(percent, input.limits),
    hint: input.hint,
    source: input.source,
  }
}

export async function getInfrastructureUsage(): Promise<InfrastructureUsagePayload> {
  const limits = getInfraLimitsConfig()
  const since = monthStartUtc()

  const [
    resendQuota,
    emailChannels,
    supabaseAuth,
    storageUsage,
    vercelUsage,
    otpProxy,
    dbMb,
    barbershops,
    trial,
    activePaid,
    canceled,
  ] = await Promise.all([
    fetchResendQuota(),
    countEmailChannelsThisMonth(),
    fetchSupabaseAuthUsage(),
    fetchSupabaseStorageUsage(),
    fetchVercelInvocationsThisMonth(),
    countOtpProxySince(since),
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

  const resendUsed = resendQuota?.monthlyUsed ?? otpProxy
  const resendSource = resendQuota ? "api" : otpProxy > 0 || process.env.RESEND_API_KEY ? "proxy" : "unavailable"

  const metrics: InfraMetric[] = [
    buildMetric({
      id: "resend_monthly",
      label: "Resend — e-mails no mês",
      description:
        resendQuota != null
          ? "Cota usada lida da API Resend (header x-resend-monthly-quota)."
          : "Proxy: OTPs registrados no banco (cadastro + cliente).",
      used: resendUsed,
      limit: limits.resendEmailsMonth,
      unit: "e-mails",
      hint:
        resendQuota != null
          ? resendQuota.dailyUsed != null
            ? `Hoje: ${resendQuota.dailyUsed} / ${limits.resendDailyEmails} (plano free). Cadastro com Google reduz envios.`
            : "Dados da API Resend. Cadastro com Google reduz envios."
          : "Configure RESEND_API_KEY para leitura direta da cota.",
      source: resendQuota ? "api" : "database",
      limits,
    }),
    buildMetric({
      id: "email_via_resend",
      label: "Canal Resend (OTP)",
      description: "Cadastro dono + cliente enviados pela API Resend neste mês.",
      used: emailChannels.viaResend,
      limit: limits.resendEmailsMonth,
      unit: "envios",
      hint: "Contagem interna por registro no banco (código real = Resend).",
      source: "database",
      limits,
    }),
    buildMetric({
      id: "email_via_supabase",
      label: "Canal Supabase Auth / SMTP",
      description: "OTP cliente (fallback), barbeiro e cadastro sem Resend — e-mail pelo Supabase.",
      used: emailChannels.viaSupabase,
      limit: limits.resendEmailsMonth,
      unit: "envios",
      hint: "Não consome cota Resend, mas conta no limite de e-mail do Supabase Auth.",
      source: "database",
      limits,
    }),
    buildMetric({
      id: "supabase_mau",
      label: "Supabase Auth — MAU",
      description: "Usuários com login (last_sign_in_at) neste mês no schema auth.users.",
      used: supabaseAuth?.mau ?? 0,
      limit: limits.supabaseMauMonth,
      unit: "usuários",
      hint: supabaseAuth
        ? "Leitura direta do Postgres (auth.users). Login só com senha no painel não cria usuário Auth."
        : "Não foi possível ler auth.users — confira permissões do banco.",
      source: supabaseAuth ? "database" : "estimate",
      limits,
    }),
    buildMetric({
      id: "google_auth",
      label: "Login Google (Auth)",
      description: "Usuários Auth com identidade Google ativos neste mês — gratuito, sem cota Resend.",
      used: supabaseAuth?.googleSignIns ?? 0,
      limit: Math.max(limits.supabaseMauMonth, 1),
      unit: "logins",
      hint: "Incentivar Google no /login e no agendamento /b/:slug para economizar e-mails OTP.",
      source: "database",
      limits,
      forceStatus: "ok",
    }),
    buildMetric({
      id: "supabase_db",
      label: "Banco de dados (Postgres)",
      description: "Tamanho atual do banco no Supabase.",
      used: dbMb ?? 0,
      limit: limits.supabaseDbMb,
      unit: "MB",
      hint: dbMb === null ? "Não foi possível ler o tamanho do banco." : "Cresce com barbearias, agendamentos e auditoria.",
      source: "database",
      limits,
    }),
    buildMetric({
      id: "supabase_storage",
      label: "Storage — Trim Player",
      description: `Bucket ${process.env.NEXT_PUBLIC_SUPABASE_URL ? "trimplay-audio" : "Supabase"} (áudios globais).`,
      used: storageUsage?.mb ?? 0,
      limit: limits.supabaseStorageMb,
      unit: "MB",
      hint: storageUsage
        ? `${storageUsage.objectCount} arquivo(s). Limite free Supabase ≈ 1 GB total do projeto.`
        : "Confira SUPABASE_SERVICE_ROLE_KEY e o bucket trimplay-audio.",
      source: storageUsage ? "api" : "estimate",
      limits,
    }),
    buildMetric({
      id: "vercel_invocations",
      label: "Vercel — invocações (Functions)",
      description: "Requisições a serverless functions no mês (API Observability v2).",
      used: vercelUsage?.invocations ?? 0,
      limit: limits.vercelInvocationsMonth,
      unit: "invocações",
      hint: vercelUsage
        ? "Leitura via VERCEL_API_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID."
        : isVercelUsageConfigured()
          ? "Token configurado, mas a API não respondeu — veja o painel Vercel → Usage."
          : "Opcional: VERCEL_API_TOKEN, VERCEL_TEAM_ID e VERCEL_PROJECT_ID na Vercel.",
      source: vercelUsage ? "api" : "env",
      limits,
    }),
    buildMetric({
      id: "otp_cadastro_ref",
      label: "Cadastros OTP (referência)",
      description: `Com ~1,3 envio por cadastro, ~${limits.otpMonthlyReference} cadastros/mês ≈ teto Resend.`,
      used: otpProxy,
      limit: limits.otpMonthlyReference,
      unit: "envios",
      hint: "Referência histórica — use a linha Resend API como principal.",
      source: "estimate",
      limits,
    }),
  ]

  if (dbMb === null) {
    const dbMetric = metrics.find((m) => m.id === "supabase_db")
    if (dbMetric) {
      dbMetric.status = "unknown"
      dbMetric.percent = null
    }
  }

  if (!storageUsage) {
    const stMetric = metrics.find((m) => m.id === "supabase_storage")
    if (stMetric) {
      stMetric.status = "unknown"
      stMetric.percent = null
    }
  }

  if (!vercelUsage) {
    const vMetric = metrics.find((m) => m.id === "vercel_invocations")
    if (vMetric) {
      vMetric.status = "unknown"
      vMetric.percent = null
    }
  }

  if (!supabaseAuth) {
    const mauMetric = metrics.find((m) => m.id === "supabase_mau")
    if (mauMetric) {
      mauMetric.status = "unknown"
      mauMetric.percent = null
    }
    const googleMetric = metrics.find((m) => m.id === "google_auth")
    if (googleMetric) {
      googleMetric.status = "unknown"
      googleMetric.percent = null
    }
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
      vercel_usage_configured: isVercelUsageConfigured(),
      resend_quota_source: resendSource,
    },
    email_channels: {
      via_resend: emailChannels.viaResend,
      via_supabase: emailChannels.viaSupabase,
    },
  }
}
