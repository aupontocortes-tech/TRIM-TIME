export type VercelUsageSnapshot = {
  invocations: number
  source: "api"
}

function monthStartUtc(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function getVercelConfig(): { token: string; teamId: string; projectId: string } | null {
  const token = (process.env.VERCEL_API_TOKEN ?? process.env.VERCEL_TOKEN)?.trim()
  const teamId = (process.env.VERCEL_TEAM_ID ?? process.env.VERCEL_ORG_ID)?.trim()
  const projectId = process.env.VERCEL_PROJECT_ID?.trim()
  if (!token || !teamId || !projectId) return null
  return { token, teamId, projectId }
}

/** Invocações de Functions no mês (API Observability v2 — opcional). */
export async function fetchVercelInvocationsThisMonth(): Promise<VercelUsageSnapshot | null> {
  const cfg = getVercelConfig()
  if (!cfg) return null

  const start = monthStartUtc()
  const end = new Date()

  const body = {
    scope: {
      type: "project" as const,
      ownerId: cfg.teamId,
      projectIds: [cfg.projectId],
    },
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    granularity: "1d",
    metric: "vercel.functions.invocations.count",
    aggregation: "sum",
  }

  try {
    const res = await fetch("https://api.vercel.com/v2/observability/query", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    if (!res.ok) return null

    const json = (await res.json()) as {
      summary?: Array<{ value?: number }>
      data?: Array<{ value?: number }>
    }

    const values = [
      ...(json.summary ?? []).map((r) => r.value ?? 0),
      ...(json.data ?? []).map((r) => r.value ?? 0),
    ]
    const invocations = values.reduce((a, b) => a + b, 0)
    if (!Number.isFinite(invocations)) return null

    return { invocations: Math.round(invocations), source: "api" }
  } catch {
    return null
  }
}

export function isVercelUsageConfigured(): boolean {
  return getVercelConfig() != null
}
