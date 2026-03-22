"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Calendar, 
  Users, 
  DollarSign, 
  TrendingUp,
  Clock,
  Check,
  X,
  ChevronRight,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { useBarbershop } from "@/hooks/use-barbershop"
import type { DashboardStats } from "@/lib/db/types"
import type { Appointment } from "@/lib/db/types"

export default function PainelDashboard() {
  const { barbershop, loading: barbershopLoading } = useBarbershop()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [agendamentosHoje, setAgendamentosHoje] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (barbershopLoading) return
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      fetch("/api/dashboard", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/appointments?date=${today}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
    ]).then(([dashboardData, appointments]) => {
      setStats(dashboardData)
      setAgendamentosHoje(Array.isArray(appointments) ? appointments : [])
    }).finally(() => setLoading(false))
  }, [barbershopLoading])

  const isLoading = barbershopLoading || loading
  const nomeBarbearia = barbershop?.name ?? "Barbearia"

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Olá!</h1>
          <p className="text-muted-foreground">Veja como está {nomeBarbearia} hoje.</p>
        </div>
        <Link href="/painel/agenda">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Calendar className="w-4 h-4 mr-2" />
            Ver Agenda Completa
          </Button>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Agendamentos Hoje</p>
                <p className="text-3xl font-bold text-foreground">
                  {isLoading ? "—" : (stats?.appointmentsToday ?? 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Faturamento Hoje</p>
                <p className="text-3xl font-bold text-foreground">
                  {isLoading ? "—" : `R$${(stats?.revenueToday ?? 0).toLocaleString("pt-BR")}`}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Faturamento (Mês)</p>
                <p className="text-3xl font-bold text-foreground">
                  {isLoading ? "—" : `R$${(stats?.revenueMonth ?? 0).toLocaleString("pt-BR")}`}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Barbeiro Destaque</p>
                <p className="text-2xl font-bold text-foreground truncate max-w-[120px]">
                  {isLoading ? "—" : (stats?.topBarber?.barber_name ?? "—")}
                </p>
                {stats?.topBarber && (
                  <p className="text-xs text-muted-foreground">{stats.topBarber.count} atendimentos hoje</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`bg-card border-border ${!isLoading && stats && !stats.commissionEnabled ? "cursor-pointer transition-opacity hover:opacity-95" : ""}`}
          role={!isLoading && stats && !stats.commissionEnabled ? "button" : undefined}
          tabIndex={!isLoading && stats && !stats.commissionEnabled ? 0 : undefined}
          onClick={
            !isLoading && stats && !stats.commissionEnabled
              ? () =>
                  window.alert(
                    "Comissões por barbeiro estão disponíveis nos planos Pro e Premium. Faça upgrade para liberar este recurso."
                  )
              : undefined
          }
          onKeyDown={
            !isLoading && stats && !stats.commissionEnabled
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    window.alert(
                      "Comissões por barbeiro estão disponíveis nos planos Pro e Premium. Faça upgrade para liberar este recurso."
                    )
                  }
                }
              : undefined
          }
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground mb-1">Comissões (mês)</p>
                {isLoading ? (
                  <p className="text-3xl font-bold text-foreground">—</p>
                ) : stats?.commissionEnabled ? (
                  <>
                    <p className="text-3xl font-bold text-foreground">
                      R${(stats.commissionMonth ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <Link
                      href="/painel/financeiro"
                      className="text-xs text-primary hover:underline mt-1 inline-block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Ver no financeiro
                    </Link>
                  </>
                ) : (
                  <p className="text-3xl font-bold text-muted-foreground">—</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Wallet className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Novos clientes este mês: <strong className="text-foreground">{isLoading ? "—" : (stats?.newClientsMonth ?? 0)}</strong>
          </p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-foreground">Agenda de Hoje</CardTitle>
            <Link href="/painel/agenda" className="text-sm text-primary hover:underline flex items-center">
              Ver todas <ChevronRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Carregando...</p>
              ) : agendamentosHoje.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum agendamento hoje.</p>
              ) : (
                agendamentosHoje.slice(0, 6).map((agendamento) => (
                  <div 
                    key={agendamento.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 border border-border/50"
                  >
                    <div className="text-center min-w-[50px]">
                      <p className="text-sm font-semibold text-primary">
                        {typeof agendamento.time === "string" ? agendamento.time.slice(0, 5) : agendamento.time}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {(agendamento as Appointment & { client?: { name?: string }; service?: { name?: string } }).client?.name ?? "Cliente"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(agendamento as Appointment & { service?: { name?: string } }).service?.name ?? "Serviço"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        agendamento.status === "confirmed"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-yellow-500/10 text-yellow-500"
                      }`}>
                        {agendamento.status === "confirmed" ? "Confirmado" : "Pendente"}
                      </span>
                      {agendamento.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:bg-green-500/10">
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-foreground">Hoje</CardTitle>
            <Link href="/painel/financeiro" className="text-sm text-primary hover:underline flex items-center">
              Ver todas <ChevronRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Carregando...</p>
              ) : agendamentosHoje.filter((a) => a.status === "completed" || a.status === "confirmed").length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma venda ainda.</p>
              ) : (
                agendamentosHoje
                  .filter((a) => a.status === "completed" || a.status === "confirmed")
                  .slice(0, 5)
                  .map((agendamento) => (
                    <div key={agendamento.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-xs font-semibold text-primary">
                            {((agendamento as Appointment & { client?: { name?: string } }).client?.name ?? "?")
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {(agendamento as Appointment & { client?: { name?: string } }).client?.name ?? "Cliente"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            R$ {Number(agendamento.total_price ?? 0).toFixed(0)}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-green-500">
                        +R${Number(agendamento.total_price ?? 0).toFixed(0)}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/painel/agenda">
          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Gerenciar Agenda</p>
                <p className="text-xs text-muted-foreground">Ver todos os horários</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/painel/clientes">
          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="font-medium text-foreground">Clientes</p>
                <p className="text-xs text-muted-foreground">Gerenciar clientes</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/painel/financeiro">
          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-foreground">Financeiro</p>
                <p className="text-xs text-muted-foreground">Relatórios e vendas</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/painel/configuracoes">
          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-secondary/80 transition-colors">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Horários</p>
                <p className="text-xs text-muted-foreground">Definir folgas</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
