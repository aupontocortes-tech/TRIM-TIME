"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { CommissionsSummaryResponse } from "@/lib/commissions"
import type { PnlData } from "@/components/painel/financeiro-pnl-section"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { FileDown, Loader2 } from "lucide-react"

const CORES = ["#d4a853", "#8b7355", "#6b9080", "#a67c52", "#5c6bc0", "#c97b84", "#7d8597", "#e09f3e"]

function brl(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR")
}

function shortDayLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" })
}

type FinancialData = {
  revenue: number
  revenue_previous: number
  ticket_avg: number
  appointment_sale_count: number
  daily: { date: string; revenue: number }[]
  by_service: {
    service_id: string
    nome: string
    revenue: number
    percent: number
  }[]
}

type Props = {
  from: string
  to: string
  isNetworkView: boolean
  unitLabel: string | null
  financial: FinancialData | null
  pnl: PnlData | null
  commissions: CommissionsSummaryResponse | null
  loading: boolean
}

function PieBlock({
  title,
  hint,
  data,
  empty,
}: {
  title: string
  hint: string
  data: { name: string; value: number; percent?: number }[]
  empty: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent>
        {total <= 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">{empty}</p>
        ) : (
          <>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={2}
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number | string, _n, item) => {
                      const row = item?.payload as { name?: string; percent?: number }
                      const v = Number(value)
                      const pct = row?.percent ?? (total > 0 ? Math.round((v / total) * 1000) / 10 : 0)
                      return [`R$ ${brl(v)} (${pct}%)`, row?.name ?? ""]
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 space-y-1.5">
              {data.map((item, i) => (
                <li key={item.name} className="flex items-center justify-between text-sm gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: CORES[i % CORES.length] }}
                    />
                    <span className="truncate text-foreground">{item.name}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {item.percent != null ? `${item.percent}%` : `${total > 0 ? Math.round((item.value / total) * 100) : 0}%`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function FinanceiroRelatorioSection({
  from,
  to,
  isNetworkView,
  unitLabel,
  financial,
  pnl,
  commissions,
  loading,
}: Props) {
  const revenue = financial?.revenue ?? 0
  const expenses = pnl?.expenses_total ?? 0
  const commTotal = pnl?.commission_enabled ? (pnl?.commissions_total ?? 0) : 0
  const profit = pnl?.owner_profit ?? revenue - expenses - commTotal

  const prev = financial?.revenue_previous ?? 0
  const growth =
    prev > 0 ? Math.round(((revenue - prev) / prev) * 1000) / 10 : revenue > 0 ? 100 : 0

  const servicePie =
    financial?.by_service
      .filter((s) => s.revenue > 0)
      .map((s) => ({ name: s.nome, value: s.revenue, percent: s.percent })) ?? []

  const expensePie =
    pnl?.expenses_by_category
      .filter((c) => c.amount > 0)
      .map((c) => ({
        name: c.label,
        value: c.amount,
        percent: expenses > 0 ? Math.round((c.amount / expenses) * 1000) / 10 : 0,
      })) ?? []

  const overviewPie = [
    ...(profit > 0 ? [{ name: "Lucro do dono", value: profit }] : []),
    ...(expenses > 0 ? [{ name: "Despesas", value: expenses }] : []),
    ...(commTotal > 0 ? [{ name: "Comissões", value: commTotal }] : []),
  ]

  const commissionPie =
    commissions?.enabled && commissions.byBarber.length
      ? commissions.byBarber.map((b) => ({
          name: b.barber_name,
          value: b.amount,
          percent: commTotal > 0 ? Math.round((b.amount / commTotal) * 1000) / 10 : 0,
        }))
      : []

  const dailyChart =
    financial?.daily.map((d) => ({
      dia: shortDayLabel(d.date),
      valor: d.revenue,
    })) ?? []

  const handlePrint = () => window.print()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Montando relatório…
      </div>
    )
  }

  return (
    <div className="space-y-5 print:space-y-4" id="financeiro-relatorio">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Relatório do período</h2>
          <p className="text-sm text-muted-foreground">
            {fmtDate(from)} até {fmtDate(to)}
            {unitLabel ? ` · ${unitLabel}` : isNetworkView ? " · Todas as unidades" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <FileDown className="w-4 h-4 mr-2" />
          Imprimir / PDF
        </Button>
      </div>

      <Card className="border-primary/30 bg-primary/5 border">
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-medium text-foreground">Resumo do período</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {revenue <= 0 && expenses <= 0 && commTotal <= 0 ? (
              <>Não há movimentação registrada entre {fmtDate(from)} e {fmtDate(to)}.</>
            ) : (
              <>
                Sua barbearia <strong className="text-foreground">faturou R$ {brl(revenue)}</strong>
                {financial?.appointment_sale_count
                  ? ` em ${financial.appointment_sale_count} agendamento(s) confirmado(s) ou concluído(s)`
                  : ""}
                , com ticket médio de <strong className="text-foreground">R$ {brl(financial?.ticket_avg ?? 0)}</strong>.
                {prev > 0 ? (
                  <>
                    {" "}
                    Isso representa{" "}
                    <strong className={growth >= 0 ? "text-emerald-600" : "text-red-500"}>
                      {growth >= 0 ? "+" : ""}
                      {growth}%
                    </strong>{" "}
                    em relação ao período anterior equivalente.
                  </>
                ) : null}
                {(expenses > 0 || commTotal > 0) && (
                  <>
                    {" "}
                    Das entradas,{" "}
                    {expenses > 0 ? (
                      <>
                        <strong className="text-foreground">R$ {brl(expenses)}</strong> foram despesas da loja
                      </>
                    ) : null}
                    {expenses > 0 && commTotal > 0 ? " e " : ""}
                    {commTotal > 0 ? (
                      <>
                        <strong className="text-foreground">R$ {brl(commTotal)}</strong> em comissões de barbeiros
                      </>
                    ) : null}
                    , restando{" "}
                    <strong className={profit >= 0 ? "text-emerald-600" : "text-red-500"}>
                      R$ {brl(profit)} de lucro
                    </strong>{" "}
                    para o dono.
                  </>
                )}
                {revenue > 0 && expenses <= 0 && commTotal <= 0 && (
                  <>
                    {" "}
                    Nenhuma despesa ou comissão registrada no período — lucro estimado de{" "}
                    <strong className="text-emerald-600">R$ {brl(profit)}</strong>.
                  </>
                )}
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-xs text-muted-foreground">Entradas (faturamento)</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">R$ {brl(revenue)}</p>
        </div>
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-xs text-muted-foreground">Despesas</p>
          <p className="text-xl font-bold text-red-500 mt-1">R$ {brl(expenses)}</p>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs text-muted-foreground">Comissões</p>
          <p className="text-xl font-bold text-amber-600 mt-1">R$ {brl(commTotal)}</p>
        </div>
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">Lucro do dono</p>
          <p className={`text-xl font-bold mt-1 ${profit >= 0 ? "text-primary" : "text-red-500"}`}>
            R$ {brl(profit)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <PieBlock
          title="Faturamento por serviço"
          hint="Quais serviços mais geraram receita"
          data={servicePie}
          empty="Nenhum serviço faturado neste período."
        />
        <PieBlock
          title="Distribuição do faturamento"
          hint="Para onde foi o dinheiro que entrou"
          data={overviewPie}
          empty="Sem faturamento para analisar."
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <PieBlock
          title="Despesas por categoria"
          hint="Composição dos custos da loja"
          data={expensePie}
          empty="Nenhuma despesa registrada no período."
        />
        {commissions?.enabled ? (
          <PieBlock
            title="Comissões por barbeiro"
            hint="Quanto cada profissional recebeu no período"
            data={commissionPie}
            empty="Nenhuma comissão calculada no período."
          />
        ) : (
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comissões por barbeiro</CardTitle>
              <p className="text-xs text-muted-foreground">Recurso disponível nos planos Pro e Premium</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-12 text-center">—</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Faturamento dia a dia</CardTitle>
          <p className="text-xs text-muted-foreground">Evolução das entradas no período escolhido</p>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            {dailyChart.length === 0 ? (
              <p className="text-sm text-muted-foreground py-16 text-center">Sem faturamento diário no período.</p>
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
          <CardTitle className="text-base">Demonstrativo resumido</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="py-3 text-muted-foreground">(+) Faturamento bruto</td>
                <td className="py-3 text-right font-medium text-emerald-600">R$ {brl(revenue)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3 text-muted-foreground">(−) Despesas da loja</td>
                <td className="py-3 text-right font-medium text-red-500">R$ {brl(expenses)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3 text-muted-foreground">(−) Comissões dos barbeiros</td>
                <td className="py-3 text-right font-medium text-amber-600">R$ {brl(commTotal)}</td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-foreground">(=) Lucro do dono</td>
                <td className={`py-3 text-right font-bold ${profit >= 0 ? "text-primary" : "text-red-500"}`}>
                  R$ {brl(profit)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-4">
            Faturamento considera agendamentos confirmados ou concluídos com valor. Despesas são lançamentos
            registrados na aba Saídas. Comissões seguem a % configurada em Equipe.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
