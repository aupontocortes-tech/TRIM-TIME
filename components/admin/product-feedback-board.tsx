"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  FEEDBACK_STATUSES,
  type ProductFeedbackDto,
  feedbackAreaLabel,
  feedbackCategoryLabel,
  feedbackImpactLabel,
  feedbackStatusLabel,
} from "@/lib/product-feedback"
import { FeedbackStatusBadge } from "@/components/support/feedback-status-badge"
import { cn } from "@/lib/utils"
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react"

const GOLD = "#D4AF37"

type Payload = {
  items: ProductFeedbackDto[]
  summary: Record<string, number>
  unread: number
}

function SummaryPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-left transition-colors min-w-[7rem]",
        active
          ? "border-[#D4AF37]/60 bg-[#D4AF37]/10"
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
      )}
    >
      <p className="text-lg font-semibold text-white tabular-nums">{count}</p>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
    </button>
  )
}

function FeedbackDetailCard({
  item,
  onUpdated,
}: {
  item: ProductFeedbackDto
  onUpdated: () => void
}) {
  const [open, setOpen] = useState(!item.read_by_admin)
  const [status, setStatus] = useState<string>(item.status)
  const [notes, setNotes] = useState(item.admin_notes ?? "")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setStatus(item.status)
    setNotes(item.admin_notes ?? "")
  }, [item])

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const r = await fetch(`/api/admin/support/feedback/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, admin_notes: notes, read_by_admin: true }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error || "Erro ao salvar")
        return
      }
      onUpdated()
    } catch {
      setErr("Erro de rede")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      className={cn(
        "bg-zinc-950 border-zinc-800 overflow-hidden",
        !item.read_by_admin && "border-[#D4AF37]/40 ring-1 ring-[#D4AF37]/20"
      )}
    >
      <button
        type="button"
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-zinc-900/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {!item.read_by_admin ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#D4AF37]">
                Novo
              </span>
            ) : null}
            <FeedbackStatusBadge status={item.status} variant="platform" />
            <span className="text-xs text-zinc-500">
              {feedbackCategoryLabel(item.category)}
              {item.area ? ` · ${feedbackAreaLabel(item.area)}` : ""}
            </span>
          </div>
          <p className="font-medium text-white">{item.title}</p>
          <p className="text-sm text-zinc-400 truncate">
            {item.barbershop_name ?? "Barbearia"} · {feedbackImpactLabel(item.impact)}
          </p>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-zinc-500 shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-zinc-500 shrink-0" />
        )}
      </button>

      {open ? (
        <CardContent className="pt-0 pb-4 px-4 space-y-4 border-t border-zinc-800">
          <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{item.description}</p>

          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href={`/plataforma/suporte/${item.barbershop_id}`}
              className="inline-flex items-center gap-1 text-[#D4AF37] hover:underline"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Abrir chat
            </Link>
            {item.barbershop_slug ? (
              <Link
                href={`/plataforma/barbershops`}
                className="text-zinc-500 hover:text-zinc-300"
              >
                Slug: {item.barbershop_slug}
              </Link>
            ) : null}
            <span className="text-zinc-600">
              {new Date(item.created_at).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <div>
              <Label className="text-zinc-400 text-xs">Status no roadmap</Label>
              <select
                className="mt-1.5 w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 text-white text-sm px-2"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {FEEDBACK_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-zinc-400 text-xs">Notas internas (só equipe)</Label>
              <Textarea
                className="mt-1.5 min-h-[80px] bg-zinc-950 border-zinc-700 text-white text-sm"
                placeholder="Prioridade, esforço, decisão de produto…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {err ? <p className="text-sm text-red-400">{err}</p> : null}

          <Button
            type="button"
            size="sm"
            disabled={saving}
            className="bg-[#D4AF37] text-black hover:bg-[#c9a432]"
            onClick={() => void save()}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar triagem
          </Button>
        </CardContent>
      ) : null}
    </Card>
  )
}

export function ProductFeedbackBoard() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (search.trim()) params.set("q", search.trim())
      const r = await fetch(`/api/admin/support/feedback?${params.toString()}`, {
        credentials: "include",
      })
      const j = (await r.json().catch(() => ({}))) as Payload & { error?: string }
      if (r.ok) setData(j)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    void load()
  }, [load])

  const statusCounts = useMemo(() => {
    const base = Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s.id, 0])) as Record<string, number>
    if (!data?.summary) return base
    for (const [k, v] of Object.entries(data.summary)) {
      base[k] = v
    }
    return base
  }, [data?.summary])

  const total = useMemo(
    () => Object.values(statusCounts).reduce((a, b) => a + b, 0),
    [statusCounts]
  )

  return (
    <div className="space-y-6 w-full min-w-0">
      <div
        className="rounded-xl border border-[#D4AF37]/30 p-5"
        style={{ backgroundColor: `${GOLD}0c` }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#D4AF37]/40"
            style={{ backgroundColor: `${GOLD}18` }}
          >
            <Sparkles className="w-6 h-6" style={{ color: GOLD }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Feedback & roadmap de produto</h2>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl leading-relaxed">
              Sugestões estruturadas das barbearias — o que implementar, melhorar ou corrigir. Use
              os status para triagem profissional: análise, planejamento, desenvolvimento e entrega.
            </p>
            {data && data.unread > 0 ? (
              <p className="text-xs text-[#D4AF37] mt-2 font-medium">
                {data.unread} feedback(s) ainda não triado(s)
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <SummaryPill
          label="Todos"
          count={total}
          active={!statusFilter}
          onClick={() => setStatusFilter("")}
        />
        {FEEDBACK_STATUSES.map((s) => (
          <SummaryPill
            key={s.id}
            label={s.label}
            count={statusCounts[s.id] ?? 0}
            active={statusFilter === s.id}
            onClick={() => setStatusFilter(s.id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(q)}
            placeholder="Buscar título, descrição ou barbearia…"
            className="pl-9 bg-zinc-900 border-zinc-700 text-white"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-zinc-700 text-zinc-300"
          onClick={() => setSearch(q)}
        >
          Buscar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-[#D4AF37]/40 text-[#D4AF37]"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        </div>
      ) : !data?.items.length ? (
        <Card className="bg-zinc-950 border-zinc-800">
          <CardContent className="py-12 text-center text-zinc-500 text-sm">
            {statusFilter
              ? `Nenhum item com status «${feedbackStatusLabel(statusFilter)}».`
              : "Nenhum feedback ainda. As barbearias enviam em Painel → Suporte → Sugestões."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => (
            <FeedbackDetailCard key={item.id} item={item} onUpdated={load} />
          ))}
        </div>
      )}
    </div>
  )
}
