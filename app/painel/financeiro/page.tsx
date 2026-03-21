"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Download,
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
  Cell
} from "recharts"

// Mock data
const resumoFinanceiro = {
  faturamentoMes: 8540,
  faturamentoMesAnterior: 7600,
  faturamentoHoje: 385,
  totalServicos: 195,
  ticketMedio: 43.8
}

const faturamentoDiario = [
  { dia: "Seg", valor: 580 },
  { dia: "Ter", valor: 420 },
  { dia: "Qua", valor: 690 },
  { dia: "Qui", valor: 520 },
  { dia: "Sex", valor: 850 },
  { dia: "Sáb", valor: 920 },
  { dia: "Dom", valor: 0 },
]

const faturamentoMensal = [
  { mes: "Jan", valor: 6200 },
  { mes: "Fev", valor: 6800 },
  { mes: "Mar", valor: 7100 },
  { mes: "Abr", valor: 7400 },
  { mes: "Mai", valor: 7600 },
  { mes: "Jun", valor: 8540 },
]

const servicosPorTipo = [
  { nome: "Corte", valor: 45, cor: "#d4a853" },
  { nome: "Barba", valor: 25, cor: "#8b7355" },
  { nome: "Corte + Barba", valor: 20, cor: "#c9b896" },
  { nome: "Outros", valor: 10, cor: "#5c5c5c" },
]

const transacoesRecentes = [
  { id: 1, cliente: "Carlos Silva", servico: "Corte + Barba", profissional: "Carlos", valor: 55, data: "Hoje, 09:30", tipo: "entrada" },
  { id: 2, cliente: "João Pedro", servico: "Corte Degradê", profissional: "João", valor: 45, data: "Hoje, 08:45", tipo: "entrada" },
  { id: 3, cliente: "Rafael Santos", servico: "Barba", profissional: "Carlos", valor: 25, data: "Ontem, 18:00", tipo: "entrada" },
  { id: 4, descricao: "Produtos de limpeza", valor: 120, data: "Ontem, 14:00", tipo: "saida" },
  { id: 5, cliente: "Lucas Oliveira", servico: "Pigmentação", profissional: "Rafael", valor: 80, data: "Ontem, 11:30", tipo: "entrada" },
  { id: 6, descricao: "Conta de luz", valor: 350, data: "20/03/2024", tipo: "saida" },
]

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

export default function FinanceiroPage() {
  const [periodoSelecionado, setPeriodoSelecionado] = useState("Este Mês")
  const [commissionSummary, setCommissionSummary] = useState<CommissionsSummaryResponse | null>(null)
  const [commissionLoading, setCommissionLoading] = useState(true)

  const loadCommissions = useCallback(async (period: string) => {
    setCommissionLoading(true)
    try {
      const { from, to } = dateRangeForPeriod(period)
      const res = await fetch(
        `/api/commissions/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { credentials: "include" }
      )
      if (!res.ok) {
        setCommissionSummary(null)
        return
      }
      const data = (await res.json()) as CommissionsSummaryResponse
      setCommissionSummary(data)
    } catch {
      setCommissionSummary(null)
    } finally {
      setCommissionLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCommissions(periodoSelecionado)
  }, [periodoSelecionado, loadCommissions])

  const crescimento = ((resumoFinanceiro.faturamentoMes - resumoFinanceiro.faturamentoMesAnterior) / resumoFinanceiro.faturamentoMesAnterior * 100).toFixed(1)
  const crescimentoPositivo = Number(crescimento) > 0

  const commissionChartData = (commissionSummary?.byBarber ?? []).map((b) => ({
    nome:
      b.barber_name.length > 16 ? `${b.barber_name.slice(0, 14)}…` : b.barber_name,
    comissao: b.amount,
    fullName: b.barber_name,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground">Acompanhe o desempenho da sua barbearia</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-border text-foreground hover:bg-secondary">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            + Nova Transação
          </Button>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        {periodos.map((periodo) => (
          <Button
            key={periodo}
            variant={periodoSelecionado === periodo ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodoSelecionado(periodo)}
            className={periodoSelecionado === periodo 
              ? "bg-primary text-primary-foreground hover:bg-primary/90" 
              : "border-border text-foreground hover:bg-secondary"
            }
          >
            {periodo}
          </Button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <span className={`flex items-center text-sm font-medium ${crescimentoPositivo ? 'text-green-500' : 'text-red-500'}`}>
                {crescimentoPositivo ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {crescimento}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Faturamento do Mês</p>
            <p className="text-2xl font-bold text-foreground">R${resumoFinanceiro.faturamentoMes.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Faturamento Hoje</p>
            <p className="text-2xl font-bold text-foreground">R${resumoFinanceiro.faturamentoHoje}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Total de Serviços</p>
            <p className="text-2xl font-bold text-foreground">{resumoFinanceiro.totalServicos}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Ticket Médio</p>
            <p className="text-2xl font-bold text-foreground">R${resumoFinanceiro.ticketMedio}</p>
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
              <>
                <p className="text-lg font-semibold text-muted-foreground">Pro / Premium</p>
                <Link href="/painel/configuracoes" className="text-xs text-primary hover:underline mt-1 inline-block">
                  Ver planos em Configurações
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comissões por barbeiro (Pro/Premium) */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Comissões por barbeiro</CardTitle>
          <CardDescription className="text-muted-foreground">
            Valores com base em agendamentos concluídos ou confirmados com preço, no período selecionado
            acima. Ajuste a % de cada um em Configurações → Equipe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {commissionLoading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Carregando…</p>
          ) : !commissionSummary?.enabled ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Comissão por barbeiro está disponível nos planos <strong className="text-foreground">Pro</strong> e{" "}
                <strong className="text-foreground">Premium</strong>. Faça upgrade para definir a % de cada
                profissional e acompanhar aqui.
              </p>
              <Button asChild variant="outline" className="border-border">
                <Link href="/painel/configuracoes">Abrir Configurações</Link>
              </Button>
            </div>
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

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily Revenue */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Faturamento da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={faturamentoDiario}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      border: '1px solid var(--border)',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'var(--foreground)' }}
                    formatter={(value) => [`R$${value}`, 'Faturamento']}
                  />
                  <Bar dataKey="valor" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={faturamentoMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      border: '1px solid var(--border)',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'var(--foreground)' }}
                    formatter={(value) => [`R$${value}`, 'Faturamento']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="valor" 
                    stroke="var(--primary)" 
                    strokeWidth={2}
                    dot={{ fill: 'var(--primary)', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Services Breakdown */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Serviços por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={servicosPorTipo}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="valor"
                  >
                    {servicosPorTipo.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      border: '1px solid var(--border)',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => [`${value}%`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {servicosPorTipo.map((item) => (
                <div key={item.nome} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.cor }} />
                  <span className="text-sm text-muted-foreground">{item.nome}</span>
                  <span className="text-sm font-medium text-foreground ml-auto">{item.valor}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-foreground">Transações Recentes</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
              Ver todas
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transacoesRecentes.map((transacao) => (
                <div 
                  key={transacao.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    transacao.tipo === 'entrada' ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}>
                    {transacao.tipo === 'entrada' ? (
                      <ArrowUpRight className="w-5 h-5 text-green-500" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {transacao.cliente || transacao.descricao}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {transacao.servico ? `${transacao.servico} - ${transacao.profissional}` : transacao.data}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`font-semibold ${
                      transacao.tipo === 'entrada' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {transacao.tipo === 'entrada' ? '+' : '-'}R${transacao.valor}
                    </p>
                    <p className="text-xs text-muted-foreground">{transacao.data}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
