"use client"

import { useState, useEffect, useCallback } from "react"
import { useUnits } from "@/hooks/use-units"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { CommissionsSummaryResponse } from "@/lib/commissions"
import { FinanceiroPnlSection, type PnlData } from "@/components/painel/financeiro-pnl-section"
import { FinanceiroRelatorioSection } from "@/components/painel/financeiro-relatorio-section"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const periodos = ["Hoje", "Esta Semana", "Este Mês", "Trimestre", "Semestre", "Este Ano", "Personalizado"]

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function dateRangeForPeriod(period: string, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date()
  const to = toYMD(now)
  if (period === "Personalizado" && customFrom && customTo) {
    return customFrom <= customTo ? { from: customFrom, to: customTo } : { from: customTo, to: customFrom }
  }
  if (period === "Hoje") return { from: to, to }
  if (period === "Esta Semana") {
    const d = new Date(now)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return { from: toYMD(d), to }
  }
  if (period === "Este Mês") {
    return { from: toYMD(new Date(now.getFullYear(), now.getMonth(), 1)), to }
  }
  if (period === "Trimestre") {
    const q = Math.floor(now.getMonth() / 3)
    return { from: toYMD(new Date(now.getFullYear(), q * 3, 1)), to }
  }
  if (period === "Semestre") {
    const half = now.getMonth() < 6 ? 0 : 6
    return { from: toYMD(new Date(now.getFullYear(), half, 1)), to }
  }
  return { from: toYMD(new Date(now.getFullYear(), 0, 1)), to }
}

function shortDayLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" })
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground mt-1">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground mt-0.5">{sub}</p> : null}
    </div>
  )
}

type FinancialSummary = {
  revenue: number
  revenue_previous: number
  revenue_today: number | null
  appointment_sale_count: number
  future_appointments_count: number
  future_appointments_revenue: number
  ticket_avg: number
  daily: { date: string; revenue: number }[]
  by_service: {
    service_id: string
    nome: string
    revenue: number
    percent: number
  }[]
  recent: {
    id: string
    tipo: "entrada" | "saida"
    titulo: string
    valor: number
    quando: string
  }[]
}

export default function FinanceiroPage() {
  const { units, selectedUnitId, loading: unitsLoading } = useUnits()
  const isNetworkView = units.length > 1 && !selectedUnitId
  const activeUnitName = selectedUnitId ? units.find((u) => u.id === selectedUnitId)?.name ?? null : null

  const [periodoSelecionado, setPeriodoSelecionado] = useState("Este Mês")
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date()
    return toYMD(new Date(d.getFullYear(), d.getMonth(), 1))
  })
  const [customTo, setCustomTo] = useState(() => toYMD(new Date()))
  const [pnlRefresh, setPnlRefresh] = useState(0)
  const [commissionSummary, setCommissionSummary] = useState<CommissionsSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [financial, setFinancial] = useState<FinancialSummary | null>(null)
  const [pnl, setPnl] = useState<PnlData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeRange = dateRangeForPeriod(periodoSelecionado, customFrom, customTo)

  const loadPeriod = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { from, to } = dateRangeForPeriod(periodoSelecionado, customFrom, customTo)
    const today = toYMD(new Date())

    try {
      const commissionQs = new URLSearchParams({ from, to })
      const financialQs = new URLSearchParams({ from, to, today })
      const pnlQs = new URLSearchParams({ from, to })
      if (isNetworkView) {
        commissionQs.set("scope", "network")
        pnlQs.set("scope", "network")
      }

      const financialPath = isNetworkView ? "/api/financial/network-summary" : "/api/financial/summary"
      const [cRes, fRes, pRes] = await Promise.all([
        fetch(`/api/commissions/summary?${commissionQs}`, { credentials: "include" }),
        fetch(`${financialPath}?${financialQs}`, { credentials: "include" }),
        fetch(`/api/financial/expenses?${pnlQs}`, { credentials: "include" }),
      ])

      setCommissionSummary(cRes.ok ? ((await cRes.json()) as CommissionsSummaryResponse) : null)
      setPnl(pRes.ok ? ((await pRes.json()) as PnlData) : null)

      if (!fRes.ok) {
        const j = (await fRes.json().catch(() => ({}))) as { error?: string }
        setFinancial(null)
        setPnl(null)
        setError(typeof j.error === "string" ? j.error : "Erro ao carregar.")
        return
      }
      setFinancial((await fRes.json()) as FinancialSummary)
    } catch {
      setCommissionSummary(null)
      setFinancial(null)
      setPnl(null)
      setError("Erro de rede.")
    } finally {
      setLoading(false)
    }
  }, [periodoSelecionado, customFrom, customTo, isNetworkView])

  useEffect(() => {
    if (unitsLoading) return
    if (periodoSelecionado === "Personalizado" && (!customFrom || !customTo)) return
    void loadPeriod()
  }, [periodoSelecionado, loadPeriod, selectedUnitId, unitsLoading, isNetworkView, customFrom, customTo, pnlRefresh])

  const dailyChart =
    financial?.daily.map((d) => ({
      dia: shortDayLabel(d.date),
      valor: d.revenue,
    })) ?? []

  const recentEntradas = (financial?.recent ?? [])
    .filter((r) => r.tipo === "entrada")
    .slice(0, 8)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          {!unitsLoading && units.length > 1 ? (
            <p className="text-sm text-muted-foreground mt-1">
              {isNetworkView ? `Todas as unidades (${units.length})` : activeUnitName ?? "Unidade"}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {periodos.map((periodo) => (
            <Button
              key={periodo}
              variant={periodoSelecionado === periodo ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodoSelecionado(periodo)}
            >
              {periodo}
            </Button>
          ))}
        </div>
      </div>

      {periodoSelecionado === "Personalizado" ? (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="space-y-1 flex-1">
            <Label htmlFor="fin-from" className="text-xs">
              De
            </Label>
            <Input id="fin-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </div>
          <div className="space-y-1 flex-1">
            <Label htmlFor="fin-to" className="text-xs">
              Até
            </Label>
            <Input id="fin-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {activeRange.from} → {activeRange.to}
        </p>
      )}

      <Tabs defaultValue="faturamento" className="space-y-5">
        <TabsList className="w-full grid grid-cols-3 h-auto p-1">
          <TabsTrigger value="faturamento">Entradas</TabsTrigger>
          <TabsTrigger value="pagamentos">Saídas</TabsTrigger>
          <TabsTrigger value="relatorio">Relatório</TabsTrigger>
        </TabsList>

        <TabsContent value="faturamento" className="space-y-5 mt-0">
          {error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat
              label="Faturamento do período"
              value={loading ? "—" : `R$ ${brl(financial?.revenue ?? 0)}`}
            />
            <Stat
              label="Faturamento hoje"
              value={
                loading
                  ? "—"
                  : financial?.revenue_today != null
                    ? `R$ ${brl(financial.revenue_today)}`
                    : "—"
              }
            />
            <Stat label="Ticket médio" value={loading ? "—" : `R$ ${brl(financial?.ticket_avg ?? 0)}`} />
            <Stat
              label="Agendamentos futuros"
              value={loading ? "—" : String(financial?.future_appointments_count ?? 0)}
              sub={
                !loading && (financial?.future_appointments_revenue ?? 0) > 0
                  ? `R$ ${brl(financial!.future_appointments_revenue)} previstos`
                  : undefined
              }
            />
            <Stat
              label="Comissões"
              value={
                loading
                  ? "—"
                  : commissionSummary?.enabled
                    ? `R$ ${brl(commissionSummary.total ?? 0)}`
                    : "—"
              }
            />
          </div>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Faturamento por dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                {loading ? (
                  <p className="text-sm text-muted-foreground py-16 text-center">Carregando…</p>
                ) : dailyChart.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-16 text-center">Sem dados no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number | string) => [`R$ ${brl(Number(value))}`, "Faturamento"]}
                      />
                      <Bar dataKey="valor" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Últimas entradas</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Carregando…</p>
              ) : recentEntradas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma entrada no período.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {recentEntradas.map((item) => (
                    <li key={item.id} className="flex items-center justify-between py-2.5 text-sm gap-3">
                      <span className="truncate text-foreground">{item.titulo}</span>
                      <span className="shrink-0 font-medium text-emerald-600">+ R$ {brl(item.valor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamentos" className="space-y-5 mt-0">
          <FinanceiroPnlSection
            from={activeRange.from}
            to={activeRange.to}
            isNetworkView={isNetworkView}
            onChanged={() => {
              setPnlRefresh((n) => n + 1)
              void loadPeriod()
            }}
          />

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comissões por barbeiro</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
              ) : !commissionSummary?.enabled ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Disponível nos planos Pro e Premium.
                </p>
              ) : !(commissionSummary.byBarber?.length ?? 0) ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma comissão no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-left">
                        <th className="py-2 pr-3 font-medium">Barbeiro</th>
                        <th className="py-2 font-medium text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissionSummary.byBarber.map((b) => (
                        <tr key={b.barber_id} className="border-b border-border/60">
                          <td className="py-2.5 pr-3">{b.barber_name}</td>
                          <td className="py-2.5 text-right font-medium">R$ {brl(b.amount)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td className="py-2.5">Total</td>
                        <td className="py-2.5 text-right">R$ {brl(commissionSummary.total ?? 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relatorio" className="space-y-5 mt-0">
          {error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <FinanceiroRelatorioSection
            from={activeRange.from}
            to={activeRange.to}
            isNetworkView={isNetworkView}
            unitLabel={activeUnitName}
            financial={financial}
            pnl={pnl}
            commissions={commissionSummary}
            loading={loading}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
