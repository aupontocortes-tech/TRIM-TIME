"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, Activity, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react"
import type { InfraMetric, InfraStatus } from "@/lib/infrastructure-limits"
import { statusLabel } from "@/lib/infrastructure-limits"
import type { InfrastructureUsagePayload } from "@/lib/infrastructure-usage"
import { cn } from "@/lib/utils"

const GOLD = "#D4AF37"

function StatusIcon({ status }: { status: InfraStatus }) {
  if (status === "ok") return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
  if (status === "warn") return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
  if (status === "critical") return <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
  return <Activity className="w-5 h-5 text-zinc-500 shrink-0" />
}

function statusBarColor(status: InfraStatus): string {
  switch (status) {
    case "ok":
      return "bg-emerald-500"
    case "warn":
      return "bg-amber-500"
    case "critical":
      return "bg-red-500"
    default:
      return "bg-zinc-600"
  }
}

function statusBadgeClass(status: InfraStatus): string {
  switch (status) {
    case "ok":
      return "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
    case "warn":
      return "bg-amber-950/60 text-amber-300 border-amber-800/60"
    case "critical":
      return "bg-red-950/60 text-red-300 border-red-800/60"
    default:
      return "bg-zinc-900 text-zinc-400 border-zinc-700"
  }
}

function formatUsed(m: InfraMetric): string {
  const u = m.unit === "MB" ? m.used.toFixed(1) : Math.round(m.used).toLocaleString("pt-BR")
  const l =
    m.unit === "MB" ? m.limit.toLocaleString("pt-BR") : Math.round(m.limit).toLocaleString("pt-BR")
  return `${u} / ${l} ${m.unit}`
}

function MetricCard({ metric }: { metric: InfraMetric }) {
  const pct = metric.percent ?? 0
  const barWidth = metric.percent === null ? 0 : Math.min(100, pct)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-white text-sm">{metric.label}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{metric.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full border",
              statusBadgeClass(metric.status)
            )}
          >
            {statusLabel(metric.status)}
          </span>
          <StatusIcon status={metric.status} />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>{formatUsed(metric)}</span>
          <span>{metric.percent !== null ? `${metric.percent}% do limite FREE` : "—"}</span>
        </div>
        <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", statusBarColor(metric.status))}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-600">
          <span>0%</span>
          <span className="text-amber-600/80">70% atenção</span>
          <span className="text-red-500/80">90% limite</span>
        </div>
      </div>

      <p className="text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/80 pt-2">
        {metric.hint}
      </p>
    </div>
  )
}

export function InfrastructureUsagePanel() {
  const [data, setData] = useState<InfrastructureUsagePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch("/api/admin/infrastructure-usage", { credentials: "include" })
      const j = (await r.json().catch(() => ({}))) as InfrastructureUsagePayload & { error?: string }
      if (!r.ok) {
        setErr(j.error || "Não foi possível carregar")
        return
      }
      setData(j)
    } catch {
      setErr("Erro de rede")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (err) {
    return (
      <div className="space-y-3 pt-4">
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-md p-3">
          {err}
        </p>
        <Button type="button" variant="outline" className="border-zinc-700" onClick={() => void load()}>
          Tentar de novo
        </Button>
      </div>
    )
  }

  if (!data) return null

  const updated = new Date(data.updated_at).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })

  return (
    <div className="space-y-5 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 bg-emerald-950/50 text-emerald-300 border border-emerald-900/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {data.summary.ok} tranquilo
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 bg-amber-950/50 text-amber-300 border border-amber-900/50">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {data.summary.warn} atenção
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 bg-red-950/50 text-red-300 border border-red-900/50">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {data.summary.critical} no limite
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Atualizar
        </Button>
      </div>

      <p className="text-xs text-zinc-500">
        Atualizado em {updated}. Limites = planos <strong className="text-zinc-400">FREE</strong> de
        referência (Resend, Supabase). Amarelo a partir de {data.limits.warnPercent}% · vermelho a partir
        de {data.limits.criticalPercent}%.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-center">
        <div>
          <p className="text-lg font-semibold text-white">{data.business.barbershops}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Barbearias</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-white">{data.business.trial}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Trial (sem teste)</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-white">{data.business.activePaid}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Pagantes (sem teste)</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-zinc-400">{data.business.canceled}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Canceladas</p>
        </div>
      </div>

      <div className="grid gap-4">
        {data.metrics.map((m) => (
          <MetricCard key={m.id} metric={m} />
        ))}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-400 space-y-2">
        <p className="font-medium text-zinc-300">Integrações no servidor</p>
        <ul className="grid sm:grid-cols-3 gap-2">
          <li>
            Resend:{" "}
            <span className={data.integrations.resend_configured ? "text-emerald-400" : "text-amber-400"}>
              {data.integrations.resend_configured ? "configurado" : "não configurado"}
            </span>
          </li>
          <li>
            Asaas:{" "}
            <span className={data.integrations.asaas_configured ? "text-emerald-400" : "text-zinc-500"}>
              {data.integrations.asaas_configured ? "chave presente" : "sem chave"}
            </span>
          </li>
          <li>
            Supabase:{" "}
            <span
              className={
                data.integrations.supabase_url_configured ? "text-emerald-400" : "text-red-400"
              }
            >
              {data.integrations.supabase_url_configured ? "URL ok" : "faltando"}
            </span>
          </li>
        </ul>
        <p className="text-zinc-500 pt-1 border-t border-zinc-800">
          Vercel: uso de banda e invocações — consulte o painel da Vercel. MAU exato do Auth — painel
          Supabase → Usage.
        </p>
      </div>

      <div
        className="rounded-lg p-3 text-xs text-zinc-400 border border-[#D4AF37]/25"
        style={{ backgroundColor: `${GOLD}08` }}
      >
        <strong className="text-[#D4AF37]">Ordem sugerida ao crescer:</strong> Vercel Pro (app
        comercial) → Resend (muitos OTP) → Supabase Pro (MAU / banco). Cadastro com Google reduz
        e-mails no Resend.
      </div>
    </div>
  )
}
