"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Search,
  User,
  Phone,
  Calendar,
  Star,
  ChevronRight,
  Gift,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Appointment, Client, LoyaltyClientStatus } from "@/lib/db/types"
import { useUnits } from "@/hooks/use-units"
import { useBarbershop } from "@/hooks/use-barbershop"
import { clientsListUrl } from "@/lib/clients-list-url"
import { computeClientLoyaltyStatus, parseLoyaltyProgram } from "@/lib/loyalty-program"
import { hasFeature } from "@/lib/plans"
import { LoyaltyCard } from "@/components/loyalty/loyalty-card"

type ClienteEnriquecido = {
  id: string
  nome: string
  telefone: string
  email: string
  fotoUrl: string | null
  totalVisitas: number
  ultimaVisita: string
  totalGasto: number
  servicoFavorito: string
  createdAt: string
  historico: { id: string; data: string; servico: string; profissional: string; valor: number }[]
  loyaltyPoints: number
  loyaltyStatus: LoyaltyClientStatus | null
}

function formatPhone(value: string) {
  const numbers = value.replace(/\D/g, "")
  if (numbers.length <= 2) return value
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
}

export default function ClientesPage() {
  const { barbershop, plan } = useBarbershop()
  const { units, selectedUnitId, loading: unitsLoading } = useUnits()
  const loyaltyConfig =
    plan && hasFeature(plan, "loyalty_program")
      ? parseLoyaltyProgram(barbershop?.settings ?? null)
      : null
  const nomeUnidadeAtiva =
    selectedUnitId && units.length ? units.find((u) => u.id === selectedUnitId)?.name ?? null : null

  const [clientes, setClientes] = useState<ClienteEnriquecido[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState("")
  const [erro, setErro] = useState("")
  const [feedback, setFeedback] = useState("")
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteEnriquecido | null>(null)
  const [openNovoCliente, setOpenNovoCliente] = useState(false)
  const [savingNovo, setSavingNovo] = useState(false)
  const [formNovoCliente, setFormNovoCliente] = useState({ nome: "", telefone: "", email: "" })
  const [redeemBusyId, setRedeemBusyId] = useState<string | null>(null)

  const carregarDados = async () => {
    setLoading(true)
    setErro("")
    try {
      const [clientsRes, appointmentsRes] = await Promise.all([
        fetch(clientsListUrl(selectedUnitId), { credentials: "include", cache: "no-store" }),
        fetch("/api/appointments?network=1", { credentials: "include", cache: "no-store" }),
      ])
      const [clientsData, appointmentsData] = await Promise.all([
        clientsRes.ok ? clientsRes.json() : null,
        appointmentsRes.ok ? appointmentsRes.json() : [],
      ])

      if (!clientsRes.ok || !Array.isArray(clientsData)) {
        const msg =
          clientsData &&
          typeof clientsData === "object" &&
          "error" in clientsData &&
          typeof (clientsData as { error?: unknown }).error === "string"
            ? (clientsData as { error: string }).error
            : "Não foi possível carregar os clientes."
        setErro(msg)
        setClientes([])
        setAppointments([])
        return
      }

      const clients = clientsData as Client[]
      const appointments = (Array.isArray(appointmentsData) ? appointmentsData : []) as Appointment[]
      setAppointments(appointments)

      const enriched = clients.map((client) => {
        const history = appointments
          .filter((appointment) => appointment.client_id === client.id)
          .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
          .map((appointment) => ({
            id: appointment.id,
            data: String(appointment.date),
            servico: appointment.service?.name ?? "Serviço",
            profissional: appointment.barber?.name ?? "Profissional",
            valor: Number(appointment.total_price ?? appointment.service?.price ?? 0),
          }))

        const favoriteCounter = new Map<string, number>()
        for (const item of history) {
          favoriteCounter.set(item.servico, (favoriteCounter.get(item.servico) ?? 0) + 1)
        }
        const favorite = [...favoriteCounter.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"

        const loyaltyPoints = client.loyalty_points ?? 0
        return {
          id: client.id,
          nome: client.name,
          telefone: client.phone ?? "—",
          email: client.email ?? "—",
          fotoUrl: client.photo_url ?? null,
          totalVisitas: history.length,
          ultimaVisita: history[0]?.data ?? "",
          totalGasto: history.reduce((sum, item) => sum + item.valor, 0),
          servicoFavorito: favorite,
          createdAt: client.created_at,
          historico: history,
          loyaltyPoints,
          loyaltyStatus: loyaltyConfig
            ? computeClientLoyaltyStatus(loyaltyPoints, loyaltyConfig)
            : null,
        }
      })

      setClientes(enriched)
    } catch {
      setErro("Não foi possível carregar os clientes.")
      setClientes([])
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (unitsLoading) return
    void carregarDados()
  }, [selectedUnitId, units.length, unitsLoading, loyaltyConfig?.visits_required])

  const handleSalvarNovoCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNovoCliente.nome.trim()) return
    setSavingNovo(true)
    setErro("")
    setFeedback("")
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formNovoCliente.nome.trim(),
          phone: formNovoCliente.telefone.trim() || undefined,
          email: formNovoCliente.email.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(typeof data.error === "string" ? data.error : "Não foi possível salvar o cliente.")
        return
      }
      setFormNovoCliente({ nome: "", telefone: "", email: "" })
      setOpenNovoCliente(false)
      setFeedback("Cliente criado com sucesso.")
      await carregarDados()
    } catch {
      setErro("Erro ao salvar o cliente.")
    } finally {
      setSavingNovo(false)
    }
  }

  const clientesFiltrados = useMemo(
    () =>
      clientes.filter(
        (cliente) =>
          cliente.nome.toLowerCase().includes(busca.toLowerCase()) ||
          cliente.telefone.includes(busca) ||
          cliente.email.toLowerCase().includes(busca.toLowerCase())
      ),
    [clientes, busca]
  )

  const novosMes = clientes.filter((cliente) => {
    const created = new Date(cliente.createdAt)
    const now = new Date()
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
  }).length

  const ticketMedio =
    appointments.length > 0
      ? appointments.reduce((sum, appointment) => sum + Number(appointment.total_price ?? appointment.service?.price ?? 0), 0) / appointments.length
      : 0

  const handleRedeemLoyalty = async (clienteId: string) => {
    setRedeemBusyId(clienteId)
    setErro("")
    setFeedback("")
    try {
      const res = await fetch(`/api/clients/${clienteId}/loyalty/redeem`, {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(typeof data.error === "string" ? data.error : "Não foi possível registrar o resgate.")
        return
      }
      setFeedback("Recompensa marcada como utilizada.")
      await carregarDados()
      if (clienteSelecionado?.id === clienteId && data.loyalty) {
        setClienteSelecionado((prev) =>
          prev
            ? {
                ...prev,
                loyaltyPoints: data.loyalty.current_visits,
                loyaltyStatus: data.loyalty,
              }
            : prev
        )
      }
    } catch {
      setErro("Erro ao registrar resgate.")
    } finally {
      setRedeemBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">
            {units.length > 1
              ? nomeUnidadeAtiva
                ? `Clientes de toda a rede — o seletor (${nomeUnidadeAtiva}) não limita esta lista`
                : "Clientes de toda a rede — quem agenda em qualquer unidade aparece aqui"
              : "Gerencie seus clientes e histórico de atendimentos"}
          </p>
        </div>
        <Dialog open={openNovoCliente} onOpenChange={setOpenNovoCliente}>
          <DialogTrigger asChild>
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
              onClick={() => setOpenNovoCliente(true)}
            >
              + Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md z-[100]">
            <DialogHeader>
              <DialogTitle className="text-foreground">Novo Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSalvarNovoCliente} className="space-y-4">
              <div>
                <Label htmlFor="novo-nome" className="text-foreground">Nome completo</Label>
                <Input
                  id="novo-nome"
                  value={formNovoCliente.nome}
                  onChange={(e) => setFormNovoCliente((prev) => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: João da Silva"
                  className="mt-1 bg-input border-border text-foreground"
                  required
                />
              </div>
              <div>
                <Label htmlFor="novo-telefone" className="text-foreground">Telefone / WhatsApp</Label>
                <Input
                  id="novo-telefone"
                  value={formNovoCliente.telefone}
                  onChange={(e) => setFormNovoCliente((prev) => ({ ...prev, telefone: formatPhone(e.target.value) }))}
                  placeholder="(00) 00000-0000"
                  className="mt-1 bg-input border-border text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="novo-email" className="text-foreground">Email</Label>
                <Input
                  id="novo-email"
                  type="email"
                  value={formNovoCliente.email}
                  onChange={(e) => setFormNovoCliente((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="cliente@email.com"
                  className="mt-1 bg-input border-border text-foreground"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-border text-foreground hover:bg-secondary"
                  onClick={() => setOpenNovoCliente(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={savingNovo}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {savingNovo ? "Salvando..." : "Salvar Cliente"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {erro ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      ) : null}
      {feedback ? (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-600">
          {feedback}
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total de Clientes</p>
            <p className="text-2xl font-bold text-foreground">{clientes.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Novos este mês</p>
            <p className="text-2xl font-bold text-green-500">+{novosMes}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border sm:col-span-1 col-span-2">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Ticket Médio</p>
            <p className="text-2xl font-bold text-primary">
              R${ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone ou email..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Carregando clientes...</p>
              </div>
            ) : clientesFiltrados.length === 0 ? (
              <div className="text-center py-8">
                <User className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Nenhum cliente encontrado</p>
              </div>
            ) : (
              clientesFiltrados.map((cliente) => (
                <div
                  key={cliente.id}
                  onClick={() => setClienteSelecionado(cliente)}
                  className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Avatar className="h-12 w-12 shrink-0 border border-border">
                    <AvatarImage src={cliente.fotoUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary/20 text-lg font-semibold text-primary">
                      {cliente.nome
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{cliente.nome}</p>
                    <p className="text-sm text-muted-foreground">{cliente.telefone}</p>
                  </div>

                  <div className="hidden sm:block text-center px-4">
                    {cliente.loyaltyStatus?.enabled ? (
                      <>
                        <p className="text-lg font-semibold text-foreground tabular-nums">
                          {cliente.loyaltyStatus.current_visits}/{cliente.loyaltyStatus.visits_required}
                        </p>
                        <p className="text-xs text-muted-foreground">fidelidade</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold text-foreground">{cliente.totalVisitas}</p>
                        <p className="text-xs text-muted-foreground">visitas</p>
                      </>
                    )}
                  </div>

                  {cliente.loyaltyStatus?.reward_available ? (
                    <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-1 text-xs font-semibold text-green-600 shrink-0">
                      <Gift className="h-3.5 w-3.5" />
                      Recompensa
                    </span>
                  ) : null}

                  <div className="hidden md:block text-center px-4">
                    <p className="text-lg font-semibold text-primary">
                      R${cliente.totalGasto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">total gasto</p>
                  </div>

                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!clienteSelecionado} onOpenChange={() => setClienteSelecionado(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Detalhes do Cliente</DialogTitle>
          </DialogHeader>

          {clienteSelecionado && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary/25">
                  <AvatarImage src={clienteSelecionado.fotoUrl ?? undefined} alt="" />
                  <AvatarFallback className="bg-primary/20 text-2xl font-semibold text-primary">
                    {clienteSelecionado.nome
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xl font-semibold text-foreground">{clienteSelecionado.nome}</p>
                  {clienteSelecionado.telefone !== "—" ? (
                    <a href={`tel:${clienteSelecionado.telefone}`} className="text-primary flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {clienteSelecionado.telefone}
                    </a>
                  ) : null}
                </div>
              </div>

              {clienteSelecionado.loyaltyStatus?.enabled ? (
                <div className="space-y-3">
                  <LoyaltyCard status={clienteSelecionado.loyaltyStatus} compact />
                  {clienteSelecionado.loyaltyStatus.reward_available ? (
                    <Button
                      type="button"
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={redeemBusyId === clienteSelecionado.id}
                      onClick={() => void handleRedeemLoyalty(clienteSelecionado.id)}
                    >
                      <Gift className="w-4 h-4 mr-2" />
                      {redeemBusyId === clienteSelecionado.id
                        ? "Registrando…"
                        : "Marcar recompensa como utilizada"}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{clienteSelecionado.totalVisitas}</p>
                  <p className="text-xs text-muted-foreground">Visitas (histórico)</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">
                    R${clienteSelecionado.totalGasto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Gasto</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-2xl font-bold text-foreground flex items-center justify-center">
                    <Star className="w-5 h-5 text-primary fill-primary mr-1" />
                    {clienteSelecionado.totalVisitas >= 5 ? "VIP" : "Base"}
                  </p>
                  <p className="text-xs text-muted-foreground">Status</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Serviço Favorito</span>
                  <span className="text-foreground font-medium">{clienteSelecionado.servicoFavorito}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Última Visita</span>
                  <span className="text-foreground font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {clienteSelecionado.ultimaVisita
                      ? new Date(clienteSelecionado.ultimaVisita).toLocaleDateString("pt-BR")
                      : "Nunca"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-foreground font-medium">{clienteSelecionado.email}</span>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-3">Histórico de Visitas</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {clienteSelecionado.historico.length === 0 ? (
                    <div className="p-3 bg-secondary/30 rounded-lg text-sm text-muted-foreground">
                      Nenhum atendimento registrado ainda.
                    </div>
                  ) : (
                    clienteSelecionado.historico.map((visita) => (
                      <div key={visita.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-foreground">{visita.servico}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(visita.data).toLocaleDateString("pt-BR")} - {visita.profissional}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-primary">
                          R${visita.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-border text-foreground hover:bg-secondary"
                  onClick={() => setClienteSelecionado(null)}
                >
                  Fechar
                </Button>
                <Link href="/painel/agenda" className="flex-1">
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    Agendar para Cliente
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
