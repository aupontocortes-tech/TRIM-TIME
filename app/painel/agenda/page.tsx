"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Package,
  Scissors,
  ShoppingBag,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"


import { Separator } from "@/components/ui/separator"
import type { Appointment, Barber, Client, RetailProduct, Service, WaitingListItem } from "@/lib/db/types"
import { useUnits } from "@/hooks/use-units"
import { isSlotPastGraceFromYmd } from "@/lib/appointment-reminder-time"

type AgendaItem = {
  id: string
  hora: string
  cliente: string
  telefone: string
  clienteFoto: string | null
  servico: string
  /** Texto do cadastro do serviço (o que o cliente também vê). */
  servicoDescricao?: string
  duracao: number
  valor: number
  status: Appointment["status"]
  profissional: string
  raw: Appointment
}

type PainelServicoLinha = { uid: string; service_id: string; quantity: number }

type PainelProdutoLinha = { uid: string; retail_product_id: string; quantity: number }

const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

function toYMD(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function monthRangeYMD(ref: Date): { from: string; to: string } {
  const y = ref.getFullYear()
  const mo = ref.getMonth()
  const last = new Date(y, mo + 1, 0).getDate()
  const from = `${y}-${String(mo + 1).padStart(2, "0")}-01`
  const to = `${y}-${String(mo + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`
  return { from, to }
}

/** Segunda a domingo da semana que contém `ref`. */
function weekRangeYMD(ref: Date): { from: string; to: string } {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const dow = d.getDay()
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: toYMD(monday), to: toYMD(sunday) }
}

function formatarIntervaloSemana(weekRef: Date): string {
  const { from, to } = weekRangeYMD(weekRef)
  const a = new Date(`${from}T12:00:00`)
  const b = new Date(`${to}T12:00:00`)
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} – ${b.getDate()} de ${a.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`
  }
  return `${a.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} – ${b.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`
}

function formatarData(data: Date) {
  const hoje = new Date()
  const amanha = new Date(hoje)
  amanha.setDate(amanha.getDate() + 1)

  if (data.toDateString() === hoje.toDateString()) return "Hoje"
  if (data.toDateString() === amanha.toDateString()) return "Amanhã"
  return `${diasSemana[data.getDay()]}, ${data.getDate()}/${data.getMonth() + 1}`
}

function labelServicoNoSelect(s: Service): string {
  const d = (s.description ?? "").trim()
  if (!d) return s.name
  const max = 72
  const short = d.length > max ? `${d.slice(0, max - 1)}…` : d
  return `${s.name} — ${short}`
}

function newPainelLinhaUid(seed?: string): string {
  if (seed && seed !== "__legacy__") return seed
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `r_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function agendaValorExibicao(appointment: Appointment): number {
  const retail = appointment.retail_lines ?? []
  if (retail.length === 0) {
    return Number(appointment.total_price ?? appointment.service?.price ?? 0)
  }
  let svcSum = 0
  const svcLines = appointment.service_lines ?? []
  if (svcLines.length > 0) {
    for (const l of svcLines) {
      svcSum += Number(l.quantity) * Number(l.unit_price)
    }
  } else {
    svcSum = Number(
      appointment.service?.price ??
        appointment.total_price ??
        0
    )
  }
  let retailSum = 0
  for (const l of retail) {
    retailSum += Number(l.quantity) * Number(l.unit_price)
  }
  return Math.round((svcSum + retailSum) * 100) / 100
}

function mapAgendaItem(appointment: Appointment): AgendaItem {
  const lines = appointment.service_lines ?? []
  let servicoNome: string
  let desc: string
  let duracao: number

  if (lines.length === 0) {
    desc = (appointment.service?.description ?? "").trim()
    servicoNome = appointment.service?.name ?? "Serviço"
    duracao = appointment.service?.duration ?? 0
  } else {
    servicoNome = lines.map((l) => l.service?.name ?? "Serviço").join(", ")
    const firstDesc = (lines[0].service?.description ?? "").trim()
    desc =
      lines.length === 1
        ? firstDesc
        : lines
            .map((l) => {
              const n = (l.service?.name ?? "").trim()
              const d = (l.service?.description ?? "").trim()
              return d ? `${n}: ${d}` : n
            })
            .filter(Boolean)
            .join("\n\n")
    duracao = lines.reduce(
      (acc, l) => acc + (l.service?.duration ?? 0) * Math.max(1, Math.round(l.quantity ?? 1) || 1),
      0
    )
  }

  return {
    id: appointment.id,
    hora: typeof appointment.time === "string" ? appointment.time.slice(0, 5) : String(appointment.time),
    cliente: appointment.client?.name ?? "Cliente",
    telefone: appointment.client?.phone ?? "",
    clienteFoto: appointment.client?.photo_url ?? null,
    servico: servicoNome,
    servicoDescricao: desc || undefined,
    duracao,
    valor: agendaValorExibicao(appointment),
    status: appointment.status,
    profissional: appointment.barber?.name ?? "Profissional",
    raw: appointment,
  }
}

export default function AgendaPage() {
  const { units, selectedUnitId, changeUnit, loading: unitsLoading } = useUnits()
  const [secaoAgenda, setSecaoAgenda] = useState<"agenda" | "lista_espera">("agenda")
  const [waitlistRows, setWaitlistRows] = useState<WaitingListItem[]>([])
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [waitlistError, setWaitlistError] = useState("")
  const [waitlistActionId, setWaitlistActionId] = useState<string | null>(null)
  const [visao, setVisao] = useState<"dia" | "semana" | "mes">("dia")
  const [dataSelecionada, setDataSelecionada] = useState(new Date())
  const [filtroProf, setFiltroProf] = useState("Todos")
  const [agendamentos, setAgendamentos] = useState<AgendaItem[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [retailProducts, setRetailProducts] = useState<RetailProduct[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState("")
  const [error, setError] = useState("")
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  /** Confirmação antes de aplicar alteração de status no modal de detalhes. */
  const [acaoDetalhesDialog, setAcaoDetalhesDialog] = useState<
    null | "confirmar" | "concluir" | "cancelar"
  >(null)
  const [painelServicoValorOpen, setPainelServicoValorOpen] = useState(false)
  const [painelLinhasServicos, setPainelLinhasServicos] = useState<PainelServicoLinha[]>([])
  const [painelValorInput, setPainelValorInput] = useState("")
  const [painelLinhasProdutos, setPainelLinhasProdutos] = useState<PainelProdutoLinha[]>([])
  /** Recarrega serviços e produtos ao abrir o painel (lista ao vivo com o catálogo atual). */
  const [catalogoPainelBusy, setCatalogoPainelBusy] = useState(false)
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

  const carregarListaEspera = async () => {
    setWaitlistLoading(true)
    setWaitlistError("")
    try {
      const res = await fetch("/api/waiting-list", { credentials: "include", cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWaitlistRows([])
        setWaitlistError(typeof data.error === "string" ? data.error : "Não foi possível carregar a lista de espera.")
        return
      }
      setWaitlistRows(Array.isArray(data) ? (data as WaitingListItem[]) : [])
    } catch {
      setWaitlistRows([])
      setWaitlistError("Erro de rede ao carregar a lista de espera.")
    } finally {
      setWaitlistLoading(false)
    }
  }

  const carregarDependencias = async () => {
    const [barbersRes, servicesRes, clientsRes, retailRes] = await Promise.all([
      fetch("/api/barbers", { credentials: "include" }),
      fetch("/api/services", { credentials: "include", cache: "no-store" }),
      fetch("/api/clients", { credentials: "include" }),
      fetch("/api/retail-products", { credentials: "include", cache: "no-store" }),
    ])

    const [barbersData, servicesData, clientsData, retailData] = await Promise.all([
      barbersRes.ok ? barbersRes.json() : [],
      servicesRes.ok ? servicesRes.json() : [],
      clientsRes.ok ? clientsRes.json() : [],
      retailRes.ok ? retailRes.json() : [],
    ])

    setBarbers(Array.isArray(barbersData) ? (barbersData as Barber[]) : [])
    setServices(Array.isArray(servicesData) ? (servicesData as Service[]) : [])
    setClients(Array.isArray(clientsData) ? (clientsData as Client[]) : [])
    setRetailProducts(Array.isArray(retailData) ? (retailData as RetailProduct[]) : [])
  }

  const atualizarCatalogoPainelAgenda = useCallback(async () => {
    setCatalogoPainelBusy(true)
    try {
      const [servicesRes, retailRes] = await Promise.all([
        fetch("/api/services", { credentials: "include", cache: "no-store" }),
        fetch("/api/retail-products", { credentials: "include", cache: "no-store" }),
      ])
      const servicesData = await servicesRes.json().catch(() => null)
      const retailData = await retailRes.json().catch(() => null)
      if (servicesRes.ok && Array.isArray(servicesData)) {
        setServices(servicesData as Service[])
      }
      if (retailRes.ok && Array.isArray(retailData)) {
        setRetailProducts(retailData as RetailProduct[])
      }
      if (!servicesRes.ok || !retailRes.ok) {
        setError("Não foi possível atualizar o catálogo de serviços ou produtos.")
      }
    } catch {
      setError("Erro ao atualizar o catálogo de serviços e produtos.")
    } finally {
      setCatalogoPainelBusy(false)
    }
  }, [])

  const carregarAgendamentos = async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (visao === "dia") {
        params.set("date", toYMD(dataSelecionada))
      } else if (visao === "semana") {
        const { from, to } = weekRangeYMD(dataSelecionada)
        params.set("from", from)
        params.set("to", to)
      } else {
        const { from, to } = monthRangeYMD(dataSelecionada)
        params.set("from", from)
        params.set("to", to)
      }
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
      const list = (Array.isArray(data) ? data : [])
        .filter((a) => {
          if (a.status === "no_show") return false
          if (a.status === "pending" || a.status === "confirmed") {
            return !isSlotPastGraceFromYmd(a.date, a.time)
          }
          return true
        })
        .map(mapAgendaItem)
      list.sort((a, b) => {
        const da = a.raw.date ?? ""
        const db = b.raw.date ?? ""
        if (da !== db) return da.localeCompare(db)
        return a.hora.localeCompare(b.hora)
      })
      setAgendamentos(list)
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
  }, [dataSelecionada, filtroProf, barbers, visao, selectedUnitId, unitsLoading])

  const mudarDia = (dias: number) => {
    const novaData = new Date(dataSelecionada)
    novaData.setDate(novaData.getDate() + dias)
    setDataSelecionada(novaData)
  }

  const mudarMes = (delta: number) => {
    const novaData = new Date(dataSelecionada.getFullYear(), dataSelecionada.getMonth() + delta, 1)
    setDataSelecionada(novaData)
  }

  const mudarSemana = (delta: number) => {
    const novaData = new Date(dataSelecionada)
    novaData.setDate(novaData.getDate() + delta * 7)
    setDataSelecionada(novaData)
  }

  const agendamentosFiltrados = filtroProf === "Todos"
    ? agendamentos
    : agendamentos.filter((a) => a.profissional === filtroProf)

  const agendamentosPorDia = useMemo(() => {
    const map = new Map<string, AgendaItem[]>()
    for (const a of agendamentosFiltrados) {
      const key = a.raw.date ?? toYMD(dataSelecionada)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return [...map.entries()].sort(([da], [db]) => da.localeCompare(db))
  }, [agendamentosFiltrados, dataSelecionada])

  const nomeUnidadeAtiva =
    selectedUnitId && units.length ? units.find((u) => u.id === selectedUnitId)?.name ?? null : null

  const totalFaturamento = agendamentosFiltrados.reduce((acc, a) => acc + a.valor, 0)
  const totalConfirmados = agendamentosFiltrados.filter((a) => a.status === "confirmed").length
  const totalPendentes = agendamentosFiltrados.filter((a) => a.status === "pending").length

  const aplicarAcao = async (appointmentId: string, payload: Partial<{
    status: Appointment["status"]
    time: string
    date: string
    barber_id: string
    service_id: string
    service_lines?: { service_id: string; quantity: number }[]
    total_price: number
    retail_lines: { retail_product_id: string; quantity: number }[]
  }>): Promise<boolean> => {
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
        return false
      }
      if (payload.status === "confirmed") setFeedback("Agendamento confirmado.")
      else if (payload.status === "completed") setFeedback("Atendimento marcado como concluído.")
      else if (payload.status === "canceled") setFeedback("Agendamento cancelado.")
      else setFeedback("Agendamento atualizado com sucesso.")
      await carregarAgendamentos()
      if (agendamentoSelecionado?.id === appointmentId) {
        setAgendamentoSelecionado(mapAgendaItem(data as Appointment))
      }
      return true
    } catch {
      setError("Erro ao atualizar o agendamento.")
      return false
    } finally {
      setActionLoadingId(null)
    }
  }

  const servicosPainelOrdenados = useMemo(
    () => [...services].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [services]
  )

  const primeiroServicoAtivoPainelId = useMemo(
    () => services.find((s) => s.active)?.id ?? "",
    [services]
  )

  const servicosAtivosCount = useMemo(
    () => services.filter((s) => s.active).length,
    [services]
  )

  const produtosPainelOrdenados = useMemo(
    () => [...retailProducts].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [retailProducts]
  )

  const primeiroProdutoAtivoPainelId = useMemo(
    () => retailProducts.find((p) => p.active)?.id ?? "",
    [retailProducts]
  )

  const produtosAtivosCount = useMemo(
    () => retailProducts.filter((p) => p.active).length,
    [retailProducts]
  )

  const sugerirValorPainelPeloCatalogo = useCallback(() => {
    let base = 0
    for (const row of painelLinhasServicos) {
      const sid = row.service_id.trim()
      if (!sid) continue
      const svc = services.find((s) => s.id === sid)
      if (!svc) continue
      const q = Math.min(99, Math.max(1, Math.round(Number(row.quantity) || 1)))
      base += Number(svc.price) * q
    }
    let extra = 0
    for (const row of painelLinhasProdutos) {
      const pid = row.retail_product_id.trim()
      if (!pid) continue
      const p = retailProducts.find((r) => r.id === pid)
      if (!p) continue
      const q = Math.min(99, Math.max(1, Math.round(Number(row.quantity) || 1)))
      extra += Number(p.price) * q
    }
    setPainelValorInput((Math.round((base + extra) * 100) / 100).toFixed(2))
  }, [services, painelLinhasServicos, painelLinhasProdutos, retailProducts])

  const podeEditarServicoValorPainel =
    agendamentoSelecionado?.status === "pending" || agendamentoSelecionado?.status === "confirmed"

  const sincronizarPainelServicoValorComSelecao = () => {
    const sel = agendamentoSelecionado
    if (!sel) return
    const svcLines = sel.raw.service_lines ?? []
    if (svcLines.length > 0) {
      setPainelLinhasServicos(
        svcLines.map((l) => ({
          uid: newPainelLinhaUid(l.id),
          service_id: l.service_id,
          quantity: Math.min(99, Math.max(1, Math.round(Number(l.quantity) || 1))),
        }))
      )
    } else if (sel.raw.service_id) {
      setPainelLinhasServicos([
        {
          uid: newPainelLinhaUid(),
          service_id: sel.raw.service_id,
          quantity: 1,
        },
      ])
    } else {
      setPainelLinhasServicos([])
    }
    setPainelValorInput(Number(sel.valor).toFixed(2))
    setPainelLinhasProdutos(
      (sel.raw.retail_lines ?? []).map((l) => ({
        uid: l.id,
        retail_product_id: l.retail_product_id,
        quantity: Math.min(99, Math.max(1, Math.round(Number(l.quantity) || 1))),
      }))
    )
  }

  async function togglePainelServicoValor() {
    if (!painelServicoValorOpen) {
      sincronizarPainelServicoValorComSelecao()
      await atualizarCatalogoPainelAgenda()
      setPainelServicoValorOpen(true)
      return
    }
    sincronizarPainelServicoValorComSelecao()
    setPainelServicoValorOpen(false)
  }

  const salvarServicoEValorPainel = async () => {
    const sel = agendamentoSelecionado
    const svcPayload = painelLinhasServicos
      .filter((r) => r.service_id.trim())
      .map((r) => ({
        service_id: r.service_id.trim(),
        quantity: Math.min(99, Math.max(1, Math.round(Number(r.quantity) || 1))),
      }))
    if (!sel) return
    if (svcPayload.length === 0) {
      setError("Adicione ao menos um serviço válido.")
      return
    }
    const v = Number(painelValorInput)
    if (!Number.isFinite(v) || v < 0) {
      setError("Informe um valor total válido.")
      return
    }
    const linesPayload = painelLinhasProdutos
      .filter((r) => r.retail_product_id.trim())
      .map((r) => ({
        retail_product_id: r.retail_product_id.trim(),
        quantity: Math.min(99, Math.max(1, Math.round(Number(r.quantity) || 1))),
      }))
    let sumSvc = 0
    for (const row of svcPayload) {
      const svc = services.find((s) => s.id === row.service_id)
      if (!svc) continue
      sumSvc += Number(svc.price) * row.quantity
    }
    let sumProd = 0
    for (const row of linesPayload) {
      const p = retailProducts.find((r) => r.id === row.retail_product_id)
      if (!p) continue
      sumProd += Number(p.price) * row.quantity
    }
    const catalogTotalPainel =
      Math.round((Math.round(sumSvc * 100) / 100 + Math.round(sumProd * 100) / 100) * 100) / 100
    setPainelValorInput(catalogTotalPainel.toFixed(2))
    const ok = await aplicarAcao(sel.id, {
      service_lines: svcPayload,
      total_price: catalogTotalPainel,
      retail_lines: linesPayload,
    })
    if (ok) setPainelServicoValorOpen(false)
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

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={secaoAgenda === "agenda" ? "default" : "outline"}
          onClick={() => setSecaoAgenda("agenda")}
        >
          Agenda
        </Button>
        <Button
          type="button"
          size="sm"
          variant={secaoAgenda === "lista_espera" ? "default" : "outline"}
          onClick={() => {
            setSecaoAgenda("lista_espera")
            void carregarListaEspera()
          }}
        >
          Lista de espera
        </Button>
      </div>

      {secaoAgenda === "lista_espera" ? (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Lista de espera</CardTitle>
            <CardDescription>Fila por profissional e serviço. VIP aumenta a prioridade na mesma fila.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {waitlistLoading ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
              </p>
            ) : null}
            {waitlistError ? (
              <p className="text-sm text-destructive">{waitlistError}</p>
            ) : null}
            {!waitlistLoading && !waitlistError ? (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2 font-medium">Cliente</th>
                      <th className="p-2 font-medium">Serviço</th>
                      <th className="p-2 font-medium">Profissional</th>
                      <th className="p-2 font-medium">Data pref.</th>
                      <th className="p-2 font-medium">Horário pref.</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">VIP</th>
                      <th className="p-2 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitlistRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-4 text-muted-foreground text-center">
                          Nenhum cliente na fila.
                        </td>
                      </tr>
                    ) : (
                      waitlistRows.map((row) => (
                        <tr key={row.id} className="border-t border-border">
                          <td className="p-2 align-top">{row.client?.name ?? "—"}</td>
                          <td className="p-2 align-top">{row.service?.name ?? "—"}</td>
                          <td className="p-2 align-top">{row.barber?.name ?? "—"}</td>
                          <td className="p-2 align-top">{row.desired_date ?? "—"}</td>
                          <td className="p-2 align-top">{row.desired_time?.slice(0, 5) ?? "—"}</td>
                          <td className="p-2 align-top capitalize">{row.status}</td>
                          <td className="p-2 align-top">{row.priority}</td>
                          <td className="p-2 align-top">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={waitlistActionId === row.id}
                                onClick={() => {
                                  setWaitlistActionId(row.id)
                                  void fetch(`/api/waiting-list/${row.id}/notify`, {
                                    method: "POST",
                                    credentials: "include",
                                  })
                                    .then(async (res) => {
                                      if (!res.ok) {
                                        const j = await res.json().catch(() => ({}))
                                        setError(typeof j.error === "string" ? j.error : "Falha ao notificar")
                                      } else {
                                        setFeedback("Notificação registrada para o cliente.")
                                      }
                                      await carregarListaEspera()
                                    })
                                    .finally(() => setWaitlistActionId(null))
                                }}
                              >
                                Notificar
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={waitlistActionId === row.id}
                                onClick={() => {
                                  setWaitlistActionId(row.id)
                                  void fetch(`/api/waiting-list/${row.id}`, {
                                    method: "PATCH",
                                    credentials: "include",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ priority: row.priority + 1 }),
                                  })
                                    .then(async (res) => {
                                      if (!res.ok) {
                                        const j = await res.json().catch(() => ({}))
                                        setError(typeof j.error === "string" ? j.error : "Falha ao priorizar")
                                      }
                                      await carregarListaEspera()
                                    })
                                    .finally(() => setWaitlistActionId(null))
                                }}
                              >
                                VIP +1
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={waitlistActionId === row.id}
                                onClick={() => {
                                  setWaitlistActionId(row.id)
                                  void fetch(`/api/waiting-list/${row.id}`, {
                                    method: "PATCH",
                                    credentials: "include",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ status: "canceled" }),
                                  })
                                    .then(async (res) => {
                                      if (!res.ok) {
                                        const j = await res.json().catch(() => ({}))
                                        setError(typeof j.error === "string" ? j.error : "Falha ao remover")
                                      }
                                      await carregarListaEspera()
                                    })
                                    .finally(() => setWaitlistActionId(null))
                                }}
                              >
                                Remover
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
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

      {!unitsLoading && selectedUnitId && nomeUnidadeAtiva ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>
            Filtro de unidade ativo: <strong className="text-foreground">{nomeUnidadeAtiva}</strong>. Só aparecem
            agendamentos desta unidade ou sem unidade. Para ver tudo, use &quot;Todas unidades&quot; no topo do painel.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-600/40 text-foreground shrink-0"
            onClick={() => void changeUnit(null)}
          >
            Ver todas as unidades
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={visao === "dia" ? "default" : "outline"}
          className={`text-left h-auto min-h-9 py-1.5 whitespace-normal ${visao === "dia" ? "bg-primary text-primary-foreground" : "border-border"}`}
          onClick={() => setVisao("dia")}
        >
          Agendamento do dia
        </Button>
        <Button
          type="button"
          size="sm"
          variant={visao === "semana" ? "default" : "outline"}
          className={`text-left h-auto min-h-9 py-1.5 whitespace-normal ${visao === "semana" ? "bg-primary text-primary-foreground" : "border-border"}`}
          onClick={() => setVisao("semana")}
        >
          Agendamento da semana
        </Button>
        <Button
          type="button"
          size="sm"
          variant={visao === "mes" ? "default" : "outline"}
          className={`text-left h-auto min-h-9 py-1.5 whitespace-normal ${visao === "mes" ? "bg-primary text-primary-foreground" : "border-border"}`}
          onClick={() => setVisao("mes")}
        >
          Agendamento mensal
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (visao === "dia") mudarDia(-1)
                else if (visao === "semana") mudarSemana(-1)
                else mudarMes(-1)
              }}
              className="border-border text-foreground hover:bg-secondary"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="text-center px-1">
              {visao === "dia" ? (
                <>
                  <p className="text-lg font-semibold text-foreground">{formatarData(dataSelecionada)}</p>
                  <p className="text-sm text-muted-foreground">
                    {dataSelecionada.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </>
              ) : visao === "semana" ? (
                <>
                  <p className="text-lg font-semibold text-foreground">{formatarIntervaloSemana(dataSelecionada)}</p>
                  <p className="text-sm text-muted-foreground">Segunda a domingo</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-foreground">
                    {dataSelecionada.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </p>
                  <p className="text-sm text-muted-foreground">Todos os dias deste mês</p>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (visao === "dia") mudarDia(1)
                else if (visao === "semana") mudarSemana(1)
                else mudarMes(1)
              }}
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
                <p className="text-muted-foreground">
                  {visao === "dia"
                    ? "Nenhum agendamento para este dia"
                    : visao === "semana"
                      ? "Nenhum agendamento nesta semana"
                      : "Nenhum agendamento neste mês"}
                </p>
              </div>
            ) : visao === "mes" || visao === "semana" ? (
              <div className="space-y-6">
                {agendamentosPorDia.map(([diaYmd, lista]) => (
                  <div key={diaYmd}>
                    <p className="text-sm font-semibold text-primary mb-2">
                      {new Date(`${diaYmd}T12:00:00`).toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                    <div className="space-y-3">
                      {lista.map((agendamento) => (
                        <div
                          key={agendamento.id}
                          onClick={() => setAgendamentoSelecionado(agendamento)}
                          className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
                        >
                          <Avatar className="w-11 h-11 shrink-0 border border-border">
                            <AvatarImage src={agendamento.clienteFoto ?? undefined} alt="" />
                            <AvatarFallback className="bg-primary/15 text-primary text-sm font-medium">
                              {agendamento.cliente
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
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
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${
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
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              agendamentosFiltrados.map((agendamento) => (
                <div
                  key={agendamento.id}
                  onClick={() => setAgendamentoSelecionado(agendamento)}
                  className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Avatar className="w-11 h-11 shrink-0 border border-border">
                    <AvatarImage src={agendamento.clienteFoto ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary/15 text-primary text-sm font-medium">
                      {agendamento.cliente
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
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
                    {agendamento.servicoDescricao ? (
                      <p className="text-xs text-muted-foreground/85 mt-0.5 line-clamp-2 whitespace-pre-wrap">
                        {agendamento.servicoDescricao}
                      </p>
                    ) : null}
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

      <Dialog
        open={!!agendamentoSelecionado}
        onOpenChange={(open) => {
          if (!open) {
            setPainelServicoValorOpen(false)
            setAcaoDetalhesDialog(null)
            setAgendamentoSelecionado(null)
          }
        }}
      >
        <DialogContent className="fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-card p-0 shadow-lg sm:max-w-none data-[state=closed]:zoom-out-0 data-[state=open]:zoom-in-100">
          {agendamentoSelecionado && (
            <>
              <div className="shrink-0 space-y-0.5 border-b border-border px-4 py-3 pr-14 sm:px-8 lg:px-10">
                <DialogTitle className="text-left text-lg font-semibold text-foreground">
                  Detalhes do agendamento
                </DialogTitle>
                <DialogDescription className="text-left text-sm text-muted-foreground">
                  Confira cliente, valores e dados do horário. Use <span className="font-medium text-foreground">Alterar valores</span> só se precisar mudar algo.
                </DialogDescription>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6 lg:px-10">
                <div className="mx-auto w-full max-w-[min(100vw,90rem)] space-y-6">

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
                <div className="space-y-4 lg:col-span-4 xl:col-span-3">
                  <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
                    <Avatar className="h-14 w-14 shrink-0 border-2 border-primary/25">
                      <AvatarImage src={agendamentoSelecionado.clienteFoto ?? undefined} alt="" />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        <User className="h-7 w-7" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{agendamentoSelecionado.cliente}</p>
                      {agendamentoSelecionado.telefone ? (
                        <a
                          href={`tel:${agendamentoSelecionado.telefone}`}
                          className="mt-0.5 flex items-center gap-1 text-sm text-primary"
                        >
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="truncate">{agendamentoSelecionado.telefone}</span>
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-4">
                    <span className="text-sm font-medium text-foreground">Total do agendamento</span>
                    <span className="text-xl font-bold tabular-nums text-primary">
                      R${agendamentoSelecionado.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="space-y-5 lg:col-span-8 xl:col-span-9">
                  <Card className="border-border/60 shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-semibold text-foreground">Resumo deste horário</CardTitle>
                      <CardDescription>
                        Informações já salvas do agendamento (leitura). Edição fica mais abaixo.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-2">
                      <div className="flex flex-wrap gap-x-10 gap-y-3 text-base leading-snug text-foreground sm:text-[1.0625rem]">
                        <span className="flex items-center gap-2.5 tabular-nums font-medium">
                          <Clock className="h-[1.125rem] w-[1.125rem] shrink-0 text-primary sm:h-5 sm:w-5" />
                          {agendamentoSelecionado.hora}
                        </span>
                        <span>
                          <span className="text-muted-foreground">Duração: </span>
                          {agendamentoSelecionado.duracao} min
                        </span>
                        <span className="min-w-0">
                          <span className="text-muted-foreground">Profissional: </span>
                          {agendamentoSelecionado.profissional}
                        </span>
                      </div>
                      <Separator className="opacity-70" />

                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Serviços</p>
                        <ul className="mt-2 divide-y divide-border/70 rounded-lg border border-border/50 bg-background/40">
                          {(agendamentoSelecionado.raw.service_lines ?? []).length === 0 ? (
                            <li className="px-3 py-3 text-sm text-muted-foreground">Nenhum serviço registrado.</li>
                          ) : (
                            (agendamentoSelecionado.raw.service_lines ?? []).map((line, idx) => {
                              const nome = line.service?.name ?? "Serviço"
                              const linhaValor = Number(line.quantity) * Number(line.unit_price)
                              return (
                                <li
                                  key={`${line.id}-${line.service_id}-${idx}`}
                                  className="flex items-center justify-between gap-4 px-3 py-3 text-sm"
                                >
                                  <span className="min-w-0">
                                    <span className="font-medium text-foreground">{nome}</span>
                                    <span className="text-muted-foreground"> × {line.quantity}</span>
                                  </span>
                                  <span className="shrink-0 tabular-nums text-muted-foreground">
                                    R$
                                    {linhaValor.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </li>
                              )
                            })
                          )}
                        </ul>
                        {agendamentoSelecionado.servicoDescricao ? (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                            {agendamentoSelecionado.servicoDescricao}
                          </p>
                        ) : null}
                      </div>

                      <Separator className="opacity-70" />

                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Produtos</p>
                        {(agendamentoSelecionado.raw.retail_lines?.length ?? 0) === 0 ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Nenhum produto registrado neste pedido (opcional).
                          </p>
                        ) : (
                          <ul className="mt-2 divide-y divide-border/70 rounded-lg border border-border/50 bg-background/40">
                            {(agendamentoSelecionado.raw.retail_lines ?? []).map((line) => {
                              const nome = line.product?.name ?? "Produto"
                              const linhaValor = Number(line.quantity) * Number(line.unit_price)
                              return (
                                <li
                                  key={line.id}
                                  className="flex items-center justify-between gap-4 px-3 py-3 text-sm"
                                >
                                  <span className="min-w-0">
                                    <span className="font-medium text-foreground">{nome}</span>
                                    <span className="text-muted-foreground"> × {line.quantity}</span>
                                  </span>
                                  <span className="shrink-0 tabular-nums text-muted-foreground">
                                    R$
                                    {linhaValor.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {podeEditarServicoValorPainel && (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4 sm:p-5">
                  {servicosAtivosCount === 0 ? (
                    <p className="text-sm text-destructive">
                      Cadastre um serviço ativo em Configurações → Serviços para editar este agendamento.
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 min-h-12 w-full border-primary/40 text-base text-foreground hover:bg-primary/10 sm:max-w-md md:text-lg [&_svg]:size-5 py-3"
                    disabled={
                      actionLoadingId === agendamentoSelecionado.id ||
                      servicosAtivosCount === 0 ||
                      catalogoPainelBusy
                    }
                    onClick={() => void togglePainelServicoValor()}
                  >
                    {catalogoPainelBusy ? (
                      <Loader2 className="mr-2 size-5 shrink-0 animate-spin text-primary" />
                    ) : (
                      <Package className="mr-2 size-5 shrink-0 text-primary" />
                    )}
                    Alterar valores
                  </Button>
                  {painelServicoValorOpen ? (
                    <div className="mt-6 space-y-8 rounded-lg border border-border/70 bg-background/80 p-4 sm:p-5">
                      <div className="flex flex-col gap-3 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          Se você acabou de cadastrar algo em Configurações, atualize o catálogo antes de escolher.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 shrink-0 gap-2 border-border px-5 text-base text-foreground"
                          disabled={
                            catalogoPainelBusy || actionLoadingId === agendamentoSelecionado.id
                          }
                          onClick={() => void atualizarCatalogoPainelAgenda()}
                        >
                          {catalogoPainelBusy ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : null}
                          Atualizar catálogo
                        </Button>
                      </div>

                      {servicosAtivosCount === 0 ? (
                        <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                          Nenhum serviço ativo no catálogo. Cadastre em Configurações → Serviços.
                        </div>
                      ) : null}

                      <section className="space-y-3">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <Scissors className="h-4 w-4 text-primary shrink-0" aria-hidden />
                          <h3 className="text-sm font-semibold text-foreground">Serviços</h3>
                          <Separator orientation="vertical" className="hidden h-4 sm:inline bg-border/80" />
                          <p className="text-xs text-muted-foreground">
                            O que será feito neste horário; use &quot;Adicionar serviço&quot; para combinar vários (ex.: corte +
                            barba).
                          </p>
                        </div>
                        <div className="divide-y divide-border rounded-md border border-border/60 bg-muted/30">
                          {painelLinhasServicos.map((row) => {
                            const opcoes = servicosPainelOrdenados.filter(
                              (s) => s.active || s.id === row.service_id
                            )
                            return (
                              <div
                                key={row.uid}
                                className="flex flex-wrap items-end gap-3 p-3 sm:flex-nowrap"
                              >
                                <div className="min-w-[160px] flex-1">
                                  <Label className="text-xs text-muted-foreground">Serviço</Label>
                                  <select
                                    value={row.service_id}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      setPainelLinhasServicos((prev) =>
                                        prev.map((x) =>
                                          x.uid === row.uid ? { ...x, service_id: v } : x
                                        )
                                      )
                                      sugerirValorPainelPeloCatalogo()
                                    }}
                                    disabled={actionLoadingId === agendamentoSelecionado.id}
                                    className="mt-1 w-full rounded-md border border-border bg-input px-2 py-2 text-sm text-foreground"
                                  >
                                    <option value="">Selecionar…</option>
                                    {opcoes.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {labelServicoNoSelect(s)}
                                        {!s.active ? " (inativo)" : ""}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="w-20 sm:w-24">
                                  <Label className="text-xs text-muted-foreground">Qtd</Label>
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={99}
                                    value={row.quantity}
                                    onChange={(e) => {
                                      const raw = Number(e.target.value)
                                      const q = Number.isFinite(raw)
                                        ? Math.min(99, Math.max(1, Math.round(raw)))
                                        : 1
                                      setPainelLinhasServicos((prev) =>
                                        prev.map((x) =>
                                          x.uid === row.uid ? { ...x, quantity: q } : x
                                        )
                                      )
                                      sugerirValorPainelPeloCatalogo()
                                    }}
                                    disabled={actionLoadingId === agendamentoSelecionado.id}
                                    className="mt-1 h-9 bg-input border-border px-2 text-foreground"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="mb-px h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10"
                                  disabled={actionLoadingId === agendamentoSelecionado.id}
                                  onClick={() =>
                                    setPainelLinhasServicos((prev) =>
                                      prev.filter((x) => x.uid !== row.uid)
                                    )
                                  }
                                  title="Remover linha"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-11 w-full border-border/60 text-base sm:w-auto"
                          disabled={
                            actionLoadingId === agendamentoSelecionado.id ||
                            !primeiroServicoAtivoPainelId
                          }
                          onClick={() =>
                            setPainelLinhasServicos((rows) => [
                              ...rows,
                              {
                                uid: newPainelLinhaUid(),
                                service_id: primeiroServicoAtivoPainelId,
                                quantity: 1,
                              },
                            ])
                          }
                        >
                          <Plus className="mr-2 size-[1.125rem] shrink-0" />
                          Adicionar serviço
                        </Button>
                      </section>

                      <Separator className="bg-border/70" />

                      <section className="space-y-3">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <ShoppingBag className="h-4 w-4 text-primary shrink-0" aria-hidden />
                          <h3 className="text-sm font-semibold text-foreground">Produtos</h3>
                          <Separator orientation="vertical" className="hidden h-4 sm:inline bg-border/80" />
                          <p className="text-xs text-muted-foreground">
                            Opcional — extras vendidos no salão (gel, pomada etc.).
                          </p>
                        </div>
                        {produtosAtivosCount === 0 ? (
                          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                            Catálogo de produtos vazio. Cadastre em Configurações (aba Produtos) ou ignore esta parte.
                          </p>
                        ) : null}
                        <div className="divide-y divide-border rounded-md border border-border/60 bg-muted/30">
                          {painelLinhasProdutos.map((row) => {
                            const opcoes = produtosPainelOrdenados.filter(
                              (p) => p.active || p.id === row.retail_product_id
                            )
                            return (
                              <div
                                key={row.uid}
                                className="flex flex-wrap items-end gap-3 p-3 sm:flex-nowrap"
                              >
                                <div className="min-w-[160px] flex-1">
                                  <Label className="text-xs text-muted-foreground">Produto</Label>
                                  <select
                                    value={row.retail_product_id}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      setPainelLinhasProdutos((prev) =>
                                        prev.map((x) =>
                                          x.uid === row.uid ? { ...x, retail_product_id: v } : x
                                        )
                                      )
                                    }}
                                    disabled={actionLoadingId === agendamentoSelecionado.id}
                                    className="mt-1 w-full rounded-md border border-border bg-input px-2 py-2 text-sm text-foreground"
                                  >
                                    <option value="">Selecionar…</option>
                                    {opcoes.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                        {!p.active ? " (inativo)" : ""}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="w-20 sm:w-24">
                                  <Label className="text-xs text-muted-foreground">Qtd</Label>
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={99}
                                    value={row.quantity}
                                    onChange={(e) => {
                                      const raw = Number(e.target.value)
                                      const q = Number.isFinite(raw)
                                        ? Math.min(99, Math.max(1, Math.round(raw)))
                                        : 1
                                      setPainelLinhasProdutos((prev) =>
                                        prev.map((x) =>
                                          x.uid === row.uid ? { ...x, quantity: q } : x
                                        )
                                      )
                                    }}
                                    disabled={actionLoadingId === agendamentoSelecionado.id}
                                    className="mt-1 h-9 bg-input border-border px-2 text-foreground"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="mb-px h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10"
                                  disabled={actionLoadingId === agendamentoSelecionado.id}
                                  onClick={() =>
                                    setPainelLinhasProdutos((prev) =>
                                      prev.filter((x) => x.uid !== row.uid)
                                    )
                                  }
                                  title="Remover linha"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-11 w-full border-border/60 text-base sm:w-auto"
                          disabled={
                            actionLoadingId === agendamentoSelecionado.id ||
                            !primeiroProdutoAtivoPainelId
                          }
                          onClick={() =>
                            setPainelLinhasProdutos((rows) => [
                              ...rows,
                              {
                                uid: newPainelLinhaUid(),
                                retail_product_id: primeiroProdutoAtivoPainelId,
                                quantity: 1,
                              },
                            ])
                          }
                        >
                          <Plus className="mr-2 size-[1.125rem] shrink-0" />
                          Adicionar produto
                        </Button>
                      </section>

                      <Separator className="bg-border/70" />

                      <section className="space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Valor cobrado</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Digite o total ou calcule pela soma de serviços e produtos do catálogo.
                          </p>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="painel-valor" className="text-foreground">
                              Valor total (R$)
                            </Label>
                            <Input
                              id="painel-valor"
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={0.01}
                              value={painelValorInput}
                              onChange={(e) => setPainelValorInput(e.target.value)}
                              disabled={actionLoadingId === agendamentoSelecionado.id}
                              className="mt-2 max-w-xs border-border bg-input text-foreground"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 w-full gap-2 border-border px-5 text-base text-foreground sm:w-auto"
                            disabled={
                              actionLoadingId === agendamentoSelecionado.id ||
                              !painelLinhasServicos.some((r) => r.service_id.trim())
                            }
                            onClick={() => sugerirValorPainelPeloCatalogo()}
                          >
                            Calcular pelo catálogo (serviços + produtos)
                          </Button>
                        </div>
                      </section>

                      <Separator className="bg-border/70" />

                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-12 border-border px-5 text-base order-3 sm:order-none"
                          disabled={actionLoadingId === agendamentoSelecionado.id}
                          onClick={() => sincronizarPainelServicoValorComSelecao()}
                        >
                          Desfazer alterações aqui
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-12 px-5 text-base order-2 text-muted-foreground"
                          disabled={actionLoadingId === agendamentoSelecionado.id}
                          onClick={() => {
                            sincronizarPainelServicoValorComSelecao()
                            setPainelServicoValorOpen(false)
                          }}
                        >
                          Fechar edição
                        </Button>
                        <Button
                          type="button"
                          className="min-h-12 px-5 text-base order-1 bg-primary text-primary-foreground hover:bg-primary/90 sm:order-none"
                          disabled={
                            actionLoadingId === agendamentoSelecionado.id ||
                            !painelLinhasServicos.some((r) => r.service_id.trim())
                          }
                          onClick={() => void salvarServicoEValorPainel()}
                        >
                          Salvar no agendamento
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

            </div>
            </div>

              <div className="flex shrink-0 flex-wrap gap-3 border-t border-border bg-card px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-10">
                <Button
                  variant="outline"
                  className="min-h-12 flex-1 border-border px-5 text-base text-foreground hover:bg-secondary"
                  onClick={() => setAgendamentoSelecionado(null)}
                >
                  Voltar
                </Button>
                {agendamentoSelecionado.status === "pending" && (
                  <>
                    <Button
                      className="min-h-12 flex-1 bg-green-500 px-5 text-base text-white hover:bg-green-600"
                      disabled={actionLoadingId === agendamentoSelecionado.id}
                      onClick={() => setAcaoDetalhesDialog("confirmar")}
                    >
                      <Check className="mr-2 size-5 shrink-0" />
                      Finalizar
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-12 flex-1 border-destructive/30 px-5 text-base text-destructive hover:bg-destructive/10"
                      disabled={actionLoadingId === agendamentoSelecionado.id}
                      onClick={() => setAcaoDetalhesDialog("cancelar")}
                    >
                      Cancelar agendamento
                    </Button>
                  </>
                )}
                {agendamentoSelecionado.status === "confirmed" && (
                  <>
                    <Button
                      className="min-h-12 flex-1 bg-primary px-5 text-base text-primary-foreground hover:bg-primary/90"
                      disabled={actionLoadingId === agendamentoSelecionado.id}
                      onClick={() => setAcaoDetalhesDialog("concluir")}
                    >
                      Finalizar atendimento
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-12 flex-1 border-destructive/30 px-5 text-base text-destructive hover:bg-destructive/10"
                      disabled={actionLoadingId === agendamentoSelecionado.id}
                      onClick={() => setAcaoDetalhesDialog("cancelar")}
                    >
                      Cancelar agendamento
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(agendamentoSelecionado && acaoDetalhesDialog)}
        onOpenChange={(open) => {
          if (!open && actionLoadingId !== agendamentoSelecionado?.id) setAcaoDetalhesDialog(null)
        }}
      >
        <AlertDialogContent className="border-border bg-card text-foreground sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {acaoDetalhesDialog === "confirmar"
                ? "Deseja finalizar?"
                : acaoDetalhesDialog === "concluir"
                  ? "Deseja finalizar o atendimento?"
                  : acaoDetalhesDialog === "cancelar"
                    ? "Deseja cancelar?"
                    : ""}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-sm leading-relaxed">
              {acaoDetalhesDialog === "confirmar"
                ? "Ao finalizar, o horário ficará confirmado para o cliente (status Confirmado). Ele verá esta atualização no link de agendamento."
                : acaoDetalhesDialog === "concluir"
                  ? "Ao finalizar, o horário ficará como concluído na agenda. Faça isso apenas depois que o serviço tiver sido feito."
                  : acaoDetalhesDialog === "cancelar"
                    ? "Deseja cancelar este agendamento? O cliente verá esta alteração no link quando o sistema atualizar o status para Cancelado."
                    : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel
              className="min-h-11 border-border px-5 text-base text-foreground hover:bg-secondary"
              disabled={actionLoadingId === agendamentoSelecionado?.id}
            >
              Não
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={
                actionLoadingId === agendamentoSelecionado?.id || !agendamentoSelecionado || !acaoDetalhesDialog
              }
              className={`min-h-11 px-5 text-base ${
                acaoDetalhesDialog === "cancelar"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : acaoDetalhesDialog === "confirmar"
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
              onClick={() => {
                const sel = agendamentoSelecionado
                if (!sel || !acaoDetalhesDialog) return
                const kind = acaoDetalhesDialog
                void (async () => {
                  let ok = false
                  if (kind === "confirmar") ok = await aplicarAcao(sel.id, { status: "confirmed" })
                  else if (kind === "concluir") ok = await aplicarAcao(sel.id, { status: "completed" })
                  else ok = await aplicarAcao(sel.id, { status: "canceled" })
                  if (ok) setAcaoDetalhesDialog(null)
                })()
              }}
            >
              {actionLoadingId === agendamentoSelecionado?.id
                ? "Aguardando..."
                : acaoDetalhesDialog === "confirmar"
                  ? "Sim, finalizar"
                  : acaoDetalhesDialog === "concluir"
                    ? "Sim, finalizar"
                    : acaoDetalhesDialog === "cancelar"
                      ? "Sim, cancelar"
                      : ""}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                    {labelServicoNoSelect(service)}
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
        </>
      )}
    </div>
  )
}
