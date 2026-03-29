"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Phone,
  Clock,
  User,
  Filter,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Appointment, Barber, Client, Service } from "@/lib/db/types"

type AgendaItem = {
  id: string
  hora: string
  cliente: string
  telefone: string
  servico: string
  duracao: number
  valor: number
  status: Appointment["status"]
  profissional: string
  raw: Appointment
}

const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

function toYMD(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatarData(data: Date) {
  const hoje = new Date()
  const amanha = new Date(hoje)
  amanha.setDate(amanha.getDate() + 1)

  if (data.toDateString() === hoje.toDateString()) return "Hoje"
  if (data.toDateString() === amanha.toDateString()) return "Amanhã"
  return `${diasSemana[data.getDay()]}, ${data.getDate()}/${data.getMonth() + 1}`
}

function mapAgendaItem(appointment: Appointment): AgendaItem {
  return {
    id: appointment.id,
    hora: typeof appointment.time === "string" ? appointment.time.slice(0, 5) : String(appointment.time),
    cliente: appointment.client?.name ?? "Cliente",
    telefone: appointment.client?.phone ?? "",
    servico: appointment.service?.name ?? "Serviço",
    duracao: appointment.service?.duration ?? 0,
    valor: Number(appointment.total_price ?? appointment.service?.price ?? 0),
    status: appointment.status,
    profissional: appointment.barber?.name ?? "Profissional",
    raw: appointment,
  }
}

export default function AgendaPage() {
  const [dataSelecionada, setDataSelecionada] = useState(new Date())
  const [filtroProf, setFiltroProf] = useState("Todos")
  const [agendamentos, setAgendamentos] = useState<AgendaItem[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState("")
  const [error, setError] = useState("")
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<AgendaItem | null>(null)
  const [novoAgendamentoOpen, setNovoAgendamentoOpen] = useState(false)
  const [savingNovo, setSavingNovo] = useState(false)
  const [novoForm, setNovoForm] = useState({
    clientId: "",
    nome: "",
    telefone: "",
    email: "",
    barberId: "",
    serviceId: "",
    time: "",
  })

  const profissionais = useMemo(
    () => ["Todos", ...barbers.filter((b) => b.active).map((b) => b.name)],
    [barbers]
  )

  const carregarDependencias = async () => {
    const [barbersRes, servicesRes, clientsRes] = await Promise.all([
      fetch("/api/barbers", { credentials: "include" }),
      fetch("/api/services", { credentials: "include" }),
      fetch("/api/clients", { credentials: "include" }),
    ])

    const [barbersData, servicesData, clientsData] = await Promise.all([
      barbersRes.ok ? barbersRes.json() : [],
      servicesRes.ok ? servicesRes.json() : [],
      clientsRes.ok ? clientsRes.json() : [],
    ])

    setBarbers(Array.isArray(barbersData) ? (barbersData as Barber[]) : [])
    setServices(Array.isArray(servicesData) ? (servicesData as Service[]) : [])
    setClients(Array.isArray(clientsData) ? (clientsData as Client[]) : [])
  }

  const carregarAgendamentos = async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ date: toYMD(dataSelecionada) })
      const barber = barbers.find((b) => b.name === filtroProf)
      if (barber) params.set("barber_id", barber.id)
      const res = await fetch(`/api/appointments?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      })
      const data = (await res.json().catch(() => [])) as Appointment[] | { error?: string }
      if (!res.ok) {
        setError(Array.isArray(data) ? "Não foi possível carregar a agenda." : data.error || "Não foi possível carregar a agenda.")
        setAgendamentos([])
        return
      }
      setAgendamentos((Array.isArray(data) ? data : []).map(mapAgendaItem))
    } catch {
      setError("Erro ao carregar a agenda.")
      setAgendamentos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregarDependencias()
  }, [])

  useEffect(() => {
    void carregarAgendamentos()
  }, [dataSelecionada, filtroProf, barbers])

  const mudarDia = (dias: number) => {
    const novaData = new Date(dataSelecionada)
    novaData.setDate(novaData.getDate() + dias)
    setDataSelecionada(novaData)
  }

  const agendamentosFiltrados = filtroProf === "Todos"
    ? agendamentos
    : agendamentos.filter((a) => a.profissional === filtroProf)

  const totalFaturamento = agendamentosFiltrados.reduce((acc, a) => acc + a.valor, 0)
  const totalConfirmados = agendamentosFiltrados.filter((a) => a.status === "confirmed").length
  const totalPendentes = agendamentosFiltrados.filter((a) => a.status === "pending").length

  const aplicarAcao = async (appointmentId: string, payload: Partial<{
    status: Appointment["status"]
    time: string
    date: string
    barber_id: string
    service_id: string
    total_price: number
  }>) => {
    setActionLoadingId(appointmentId)
    setError("")
    setFeedback("")
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Não foi possível atualizar o agendamento.")
        return
      }
      setFeedback("Agendamento atualizado com sucesso.")
      await carregarAgendamentos()
      if (agendamentoSelecionado?.id === appointmentId) {
        setAgendamentoSelecionado(mapAgendaItem(data as Appointment))
      }
    } catch {
      setError("Erro ao atualizar o agendamento.")
    } finally {
      setActionLoadingId(null)
    }
  }

  const criarNovoAgendamento = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingNovo(true)
    setError("")
    setFeedback("")
    try {
      let clientId = novoForm.clientId
      if (!clientId) {
        const clientRes = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: novoForm.nome,
            phone: novoForm.telefone,
            email: novoForm.email,
          }),
        })
        const clientData = (await clientRes.json().catch(() => ({}))) as Client & { error?: string }
        if (!clientRes.ok || !clientData.id) {
          setError(clientData.error || "Não foi possível criar o cliente.")
          return
        }
        clientId = clientData.id
        await carregarDependencias()
      }

      const service = services.find((item) => item.id === novoForm.serviceId)
      const appointmentRes = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          client_id: clientId,
          barber_id: novoForm.barberId,
          service_id: novoForm.serviceId,
          date: toYMD(dataSelecionada),
          time: novoForm.time,
          total_price: service ? Number(service.price) : undefined,
        }),
      })
      const appointmentData = await appointmentRes.json().catch(() => ({}))
      if (!appointmentRes.ok) {
        setError(typeof appointmentData.error === "string" ? appointmentData.error : "Não foi possível criar o agendamento.")
        return
      }

      setNovoAgendamentoOpen(false)
      setNovoForm({
        clientId: "",
        nome: "",
        telefone: "",
        email: "",
        barberId: "",
        serviceId: "",
        time: "",
      })
      setFeedback("Agendamento criado com sucesso.")
      await carregarAgendamentos()
    } catch {
      setError("Erro ao criar o agendamento.")
    } finally {
      setSavingNovo(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground">Gerencie os agendamentos da sua barbearia</p>
        </div>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
          onClick={() => setNovoAgendamentoOpen(true)}
        >
          + Novo Agendamento
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-600">
          {feedback}
        </div>
      ) : null}

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => mudarDia(-1)}
              className="border-border text-foreground hover:bg-secondary"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">{formatarData(dataSelecionada)}</p>
              <p className="text-sm text-muted-foreground">
                {dataSelecionada.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => mudarDia(1)}
              className="border-border text-foreground hover:bg-secondary"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{agendamentosFiltrados.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{totalConfirmados}</p>
            <p className="text-xs text-muted-foreground">Confirmados</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{totalPendentes}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              R${totalFaturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">Previsto</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        {profissionais.map((prof) => (
          <Button
            key={prof}
            variant={filtroProf === prof ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroProf(prof)}
            className={
              filtroProf === prof
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-border text-foreground hover:bg-secondary"
            }
          >
            {prof}
          </Button>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Agendamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Carregando agenda...</p>
              </div>
            ) : agendamentosFiltrados.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Nenhum agendamento para este dia</p>
              </div>
            ) : (
              agendamentosFiltrados.map((agendamento) => (
                <div
                  key={agendamento.id}
                  onClick={() => setAgendamentoSelecionado(agendamento)}
                  className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-bold text-primary">{agendamento.hora}</p>
                    <p className="text-xs text-muted-foreground">{agendamento.duracao}min</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground truncate">{agendamento.cliente}</p>
                      <span className="text-xs text-muted-foreground px-2 py-0.5 bg-secondary rounded">
                        {agendamento.profissional}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{agendamento.servico}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-primary">
                      R${agendamento.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        agendamento.status === "confirmed"
                          ? "bg-green-500/10 text-green-500"
                          : agendamento.status === "completed"
                            ? "bg-blue-500/10 text-blue-500"
                            : agendamento.status === "canceled"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-yellow-500/10 text-yellow-500"
                      }`}
                    >
                      {agendamento.status === "confirmed"
                        ? "Confirmado"
                        : agendamento.status === "completed"
                          ? "Concluído"
                          : agendamento.status === "canceled"
                            ? "Cancelado"
                            : "Pendente"}
                    </span>
                  </div>

                  {agendamento.status === "pending" && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-500 hover:bg-green-500/10"
                        disabled={actionLoadingId === agendamento.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          void aplicarAcao(agendamento.id, { status: "confirmed" })
                        }}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        disabled={actionLoadingId === agendamento.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          void aplicarAcao(agendamento.id, { status: "canceled" })
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!agendamentoSelecionado} onOpenChange={() => setAgendamentoSelecionado(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Detalhes do Agendamento</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Informações completas do agendamento
            </DialogDescription>
          </DialogHeader>

          {agendamentoSelecionado && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{agendamentoSelecionado.cliente}</p>
                  {agendamentoSelecionado.telefone ? (
                    <a href={`tel:${agendamentoSelecionado.telefone}`} className="text-sm text-primary flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {agendamentoSelecionado.telefone}
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Horário</p>
                  <p className="font-medium text-foreground flex items-center gap-1">
                    <Clock className="w-4 h-4 text-primary" />
                    {agendamentoSelecionado.hora}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Duração</p>
                  <p className="font-medium text-foreground">{agendamentoSelecionado.duracao} minutos</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Serviço</p>
                  <p className="font-medium text-foreground">{agendamentoSelecionado.servico}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Profissional</p>
                  <p className="font-medium text-foreground">{agendamentoSelecionado.profissional}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
                <span className="text-foreground">Valor</span>
                <span className="text-xl font-bold text-primary">
                  R${agendamentoSelecionado.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-border text-foreground hover:bg-secondary"
                  onClick={() => setAgendamentoSelecionado(null)}
                >
                  Fechar
                </Button>
                {agendamentoSelecionado.status === "pending" && (
                  <>
                    <Button
                      className="flex-1 bg-green-500 text-white hover:bg-green-600"
                      disabled={actionLoadingId === agendamentoSelecionado.id}
                      onClick={() => void aplicarAcao(agendamentoSelecionado.id, { status: "confirmed" })}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Confirmar
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                      disabled={actionLoadingId === agendamentoSelecionado.id}
                      onClick={() => void aplicarAcao(agendamentoSelecionado.id, { status: "canceled" })}
                    >
                      Cancelar
                    </Button>
                  </>
                )}
                {agendamentoSelecionado.status === "confirmed" && (
                  <>
                    <Button
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={actionLoadingId === agendamentoSelecionado.id}
                      onClick={() => void aplicarAcao(agendamentoSelecionado.id, { status: "completed" })}
                    >
                      Finalizar Atendimento
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                      disabled={actionLoadingId === agendamentoSelecionado.id}
                      onClick={() => void aplicarAcao(agendamentoSelecionado.id, { status: "canceled" })}
                    >
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={novoAgendamentoOpen} onOpenChange={setNovoAgendamentoOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Novo Agendamento</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Crie um agendamento usando os dados reais da sua base.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={criarNovoAgendamento}>
            <div>
              <Label htmlFor="clientId" className="text-foreground">Cliente existente</Label>
              <select
                id="clientId"
                value={novoForm.clientId}
                onChange={(e) => setNovoForm((prev) => ({ ...prev, clientId: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
              >
                <option value="">Cadastrar cliente agora</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            {!novoForm.clientId && (
              <>
                <div>
                  <Label htmlFor="nome" className="text-foreground">Nome do cliente</Label>
                  <Input
                    id="nome"
                    value={novoForm.nome}
                    onChange={(e) => setNovoForm((prev) => ({ ...prev, nome: e.target.value }))}
                    className="mt-1 bg-input border-border"
                    required={!novoForm.clientId}
                  />
                </div>
                <div>
                  <Label htmlFor="telefone" className="text-foreground">Telefone</Label>
                  <Input
                    id="telefone"
                    value={novoForm.telefone}
                    onChange={(e) => setNovoForm((prev) => ({ ...prev, telefone: e.target.value }))}
                    className="mt-1 bg-input border-border"
                    required={!novoForm.clientId}
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={novoForm.email}
                    onChange={(e) => setNovoForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="mt-1 bg-input border-border"
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="barberId" className="text-foreground">Profissional</Label>
              <select
                id="barberId"
                value={novoForm.barberId}
                onChange={(e) => setNovoForm((prev) => ({ ...prev, barberId: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                required
              >
                <option value="">Selecione</option>
                {barbers.filter((barber) => barber.active).map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="serviceId" className="text-foreground">Serviço</Label>
              <select
                id="serviceId"
                value={novoForm.serviceId}
                onChange={(e) => setNovoForm((prev) => ({ ...prev, serviceId: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                required
              >
                <option value="">Selecione</option>
                {services.filter((service) => service.active).map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="time" className="text-foreground">Horário</Label>
              <Input
                id="time"
                type="time"
                value={novoForm.time}
                onChange={(e) => setNovoForm((prev) => ({ ...prev, time: e.target.value }))}
                className="mt-1 bg-input border-border"
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-border text-foreground hover:bg-secondary"
                onClick={() => setNovoAgendamentoOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingNovo}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {savingNovo ? "Salvando..." : "Salvar Agendamento"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
