"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DollarSign,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Wallet,
} from "lucide-react"
import type { CommissionsSummaryResponse } from "@/lib/commissions"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"

const periodos = ["Hoje", "Esta Semana", "Este Mês", "Este Ano"]

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

/** Datas locais YYYY-MM-DD (evita deslocar dia com UTC). */
function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function dateRangeForPeriod(period: string): { from: string; to: string } {
  const now = new Date()
  const to = toYMD(now)
  if (period === "Hoje") return { from: to, to }
  if (period === "Esta Semana") {
    const d = new Date(now)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return { from: toYMD(d), to }
  }
  if (period === "Este Mês") {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: toYMD(d), to }
  }
  const d = new Date(now.getFullYear(), 0, 1)
  return { from: toYMD(d), to }
}

function shortDayLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" })
}

type FinancialSummary = {
  from: string
  to: string
  revenue: number
  revenue_previous: number
  revenue_today: number | null
  appointment_sale_count: number
  ticket_avg: number
  daily: { date: string; revenue: number }[]
  monthly_six: { key: string; mes: string; valor: number }[]
  by_service: {
    service_id: string
    nome: string
    revenue: number
    count: number
    cor: string
    percent: number
  }[]
  recent: {
    id: string
    tipo: "entrada" | "saida"
    titulo: string
    sub: string
    valor: number
    quando: string
  }[]
}

export default function FinanceiroPage() {
  const [periodoSelecionado, setPeriodoSelecionado] = useState("Este Mês")
  const [commissionSummary, setCommissionSummary] = useState<CommissionsSummaryResponse | null>(null)
  const [commissionLoading, setCommissionLoading] = useState(true)
  const [financial, setFinancial] = useState<FinancialSummary | null>(null)
  const [financialLoading, setFinancialLoading] = useState(true)
  const [financialError, setFinancialError] = useState<string | null>(null)

  const loadPeriod = useCallback(async (period: string) => {
    setCommissionLoading(true)
    setFinancialLoading(true)
    setFinancialError(null)
    const { from, to } = dateRangeForPeriod(period)
    const today = toYMD(new Date())

    try {
      const [cRes, fRes] = await Promise.all([
        fetch(
          `/api/commissions/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { credentials: "include" }
        ),
        fetch(
          `/api/financial/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&today=${encodeURIComponent(today)}`,
          { credentials: "include" }
        ),
      ])

      if (cRes.ok) {
        setCommissionSummary((await cRes.json()) as CommissionsSummaryResponse)
      } else {
        setCommissionSummary(null)
      }

      if (!fRes.ok) {
        const j = (await fRes.json().catch(() => ({}))) as { error?: string }
        setFinancial(null)
        setFinancialError(typeof j.error === "string" ? j.error : "Não foi possível carregar o financeiro.")
        return
      }
      setFinancial((await fRes.json()) as FinancialSummary)
    } catch {
      setCommissionSummary(null)
      setFinancial(null)
      setFinancialError("Erro de rede ao carregar dados.")
    } finally {
      setCommissionLoading(false)
      setFinancialLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPeriod(periodoSelecionado)
  }, [periodoSelecionado, loadPeriod])

  const prev = financial?.revenue_previous ?? 0
  const rev = financial?.revenue ?? 0
  const crescimentoPct =
    prev > 0 ? (((rev - prev) / prev) * 100).toFixed(1) : rev > 0 ? "100.0" : "0.0"
  const crescimentoPositivo = Number(crescimentoPct) > 0
  const crescimentoNeutro = Number(crescimentoPct) === 0

  const commissionChartData = (commissionSummary?.byBarber ?? []).map((b) => ({
    nome: b.barber_name.length > 16 ? `${b.barber_name.slice(0, 14)}…` : b.barber_name,
    comissao: b.amount,
    fullName: b.barber_name,
  }))

  const dailyChart =
    financial?.daily.map((d) => ({
      dia: shortDayLabel(d.date),
      valor: d.revenue,
      data: d.date,
    })) ?? []

  const pieData = financial?.by_service ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground">
            Faturamento e serviços com base nos seus agendamentos (confirmados ou concluídos com valor).
          </p>
        </div>
        <Button variant="outline" asChild className="border-border text-foreground hover:bg-secondary w-full sm:w-auto">
          <Link href="/painel/agenda">Ver agenda</Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        {periodos.map((periodo) => (
          <Button
            key={periodo}
            variant={periodoSelecionado === periodo ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodoSelecionado(periodo)}
            className={
              periodoSelecionado === periodo
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-border text-foreground hover:bg-secondary"
            }
          >
            {periodo}
          </Button>
        ))}
      </div>

      {financialError ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {financialError}
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              {financialLoading ? (
                <span className="text-sm text-muted-foreground">…</span>
              ) : prev > 0 || rev > 0 ? (
                <span
                  className={`flex items-center text-sm font-medium ${
                    crescimentoNeutro
                      ? "text-muted-foreground"
                      : crescimentoPositivo
                        ? "text-green-500"
                        : "text-red-500"
                  }`}
                >
                  {crescimentoNeutro ? null : crescimentoPositivo ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {crescimentoPct}%
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-1">Faturamento no período</p>
            <p className="text-2xl font-bold text-foreground">
              {financialLoading
                ? "—"
                : `R$${rev.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              vs. período anterior equivalente (mesma quantidade de dias)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Faturamento hoje</p>
            <p className="text-2xl font-bold text-foreground">
              {financialLoading
                ? "—"
                : financial?.revenue_today != null
                  ? `R$${financial.revenue_today.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Agendamentos faturados</p>
            <p className="text-2xl font-bold text-foreground">
              {financialLoading ? "—" : (financial?.appointment_sale_count ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Ticket médio</p>
            <p className="text-2xl font-bold text-foreground">
              {financialLoading
                ? "—"
                : `R$${(financial?.ticket_avg ?? 0).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Comissões (período)</p>
            {commissionLoading ? (
              <p className="text-2xl font-bold text-foreground">—</p>
            ) : commissionSummary?.enabled ? (
              <p className="text-2xl font-bold text-foreground">
                R$
                {(commissionSummary.total ?? 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Comissões por barbeiro</CardTitle>
          <CardDescription className="text-muted-foreground">
            {commissionSummary?.enabled
              ? "Valores com base em agendamentos concluídos ou confirmados com preço, no período selecionado acima. Ajuste a % em Configurações → Equipe."
              : "Resumo por profissional."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {commissionLoading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Carregando…</p>
          ) : !commissionSummary?.enabled ? (
            <button
              type="button"
              className="w-full py-14 text-center outline-none rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card cursor-pointer"
              onClick={() =>
                window.alert(
                  "Comissões por barbeiro estão disponíveis nos planos Pro e Premium. Faça upgrade para liberar este recurso."
                )
              }
            >
              <p className="text-3xl font-bold text-muted-foreground">—</p>
            </button>
          ) : commissionChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Nenhum dado no período. Confira se os agendamentos têm valor e status concluído/confirmado.
            </p>
          ) : (
            <div className="h-72 w-full min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={commissionChartData}
                  margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickFormatter={(v) => `R$${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={100}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "var(--foreground)" }}
                    formatter={(value: number | string, _name, item) => {
                      const row = item?.payload as { fullName?: string }
                      return [
                        `R$${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                        row?.fullName ?? "Comissão",
                      ]
                    }}
                  />
                  <Bar dataKey="comissao" fill="var(--primary)" radius={[0, 6, 6, 0]} name="Comissão" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Faturamento por dia</CardTitle>
            <CardDescription className="text-muted-foreground">No intervalo selecionado acima</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {financialLoading ? (
                <p className="text-sm text-muted-foreground py-20 text-center">Carregando…</p>
              ) : dailyChart.length === 0 ? (
                <p className="text-sm text-muted-foreground py-20 text-center">Sem faturamento neste período.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "var(--foreground)" }}
                      formatter={(value: number | string, _n, item) => {
                        const row = item?.payload as { data?: string }
                        return [`R$${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, row?.data ?? ""]
                      }}
                    />
                    <Bar dataKey="valor" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Últimos 6 meses</CardTitle>
            <CardDescription className="text-muted-foreground">Mesma regra de faturamento (confirmado/concluído)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {financialLoading ? (
                <p className="text-sm text-muted-foreground py-20 text-center">Carregando…</p>
              ) : !(financial?.monthly_six?.length) ? (
                <p className="text-sm text-muted-foreground py-20 text-center">Sem dados.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={financial.monthly_six}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "var(--foreground)" }}
                      formatter={(value: number | string) => [
                        `R$${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                        "Faturamento",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={{ fill: "var(--primary)", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Serviços no período</CardTitle>
            <CardDescription className="text-muted-foreground">Participação no faturamento</CardDescription>
          </CardHeader>
          <CardContent>
            {financialLoading ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Carregando…</p>
            ) : pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Nenhum serviço faturado no período.</p>
            ) : (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        dataKey="revenue"
                        nameKey="nome"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${entry.service_id}-${index}`} fill={entry.cor} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number | string, _n, item) => {
                          const row = item?.payload as { nome?: string; percent?: number }
                          const v = Number(value)
                          return [
                            `R$${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${row?.percent ?? 0}%)`,
                            row?.nome ?? "",
                          ]
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {pieData.map((item) => (
                    <div key={item.service_id} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.cor }} />
                      <span className="text-sm text-muted-foreground truncate">{item.nome}</span>
                      <span className="text-sm font-medium text-foreground ml-auto shrink-0">
                        {item.percent}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground">Movimentação recente</CardTitle>
            <CardDescription className="text-muted-foreground">
              Agendamentos do período e lançamentos do livro caixa (se houver)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {financialLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
            ) : !(financial?.recent?.length) ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum registro no período.</p>
            ) : (
              <div className="space-y-3">
                {financial.recent.map((transacao) => (
                  <div
                    key={transacao.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        transacao.tipo === "entrada" ? "bg-green-500/10" : "bg-red-500/10"
                      }`}
                    >
                      {transacao.tipo === "entrada" ? (
                        <ArrowUpRight className="w-5 h-5 text-green-500" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-red-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{transacao.titulo}</p>
                      <p className="text-sm text-muted-foreground truncate">{transacao.sub}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`font-semibold ${
                          transacao.tipo === "entrada" ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {transacao.tipo === "entrada" ? "+" : "-"}R$
                        {transacao.valor.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">{transacao.quando}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
