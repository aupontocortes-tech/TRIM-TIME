"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Scissors,
  Clock,
  MapPin,
  Star,
  ChevronLeft,
  ChevronRight,
  Check,
  Calendar,
  Eye,
  EyeOff,
  LogOut,
  Phone,
  Building2,
  Bell,
  Camera,
} from "lucide-react"
import {
  clearConfirmedBooking,
  loadConfirmedBooking,
  saveConfirmedBooking,
  type PersistedClientBookingV1,
} from "@/lib/cliente-booking-persist"
import {
  clearSavedClientProfile,
  loadSavedClientProfile,
  saveSavedClientProfile,
} from "@/lib/cliente-booking-saved-profile"
import { formatCpfDisplay, cpfDigits } from "@/lib/cpf"
import { clientPhoneDigits, clientPhonesMatch } from "@/lib/client-phone-utils"
import { openingHoursFromSettings } from "@/lib/barbershop-settings-ui"
import type { BarbershopSettings } from "@/lib/db/types"
import { compressImageToJpegDataUrl } from "@/lib/client-image-compress"
import { MAX_PROFILE_PHOTO_DATA_URL_CHARS } from "@/lib/photo-data-url"
import { urlBase64ToUint8Array } from "@/lib/push-client-utils"
import { AppInstallPrompt } from "@/components/app-install-prompt"
import { TrimPlayGame } from "@/components/trim-play/TrimPlayGame"
import { TrimPlaySplash } from "@/components/trim-play/TrimPlaySplash"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Dados mockados da barbearia (viriam do banco de dados pelo slug)
const barbeariaData = {
  slug: "trim-time",
  nome: "Trim Time",
  descricao: "Sua barbearia de confiança. Corte, barba e cuidado masculino.",
  logo: "/icon.png",
  capa: "/placeholder.svg",
  endereco: "Rua das Flores, 123 - Centro",
  cidade: "São Paulo, SP",
  telefone: "(11) 99999-9999",
  instagram: "@trimtime",
  horarioFuncionamento: "Seg-Sab: 9h às 20h",
  avaliacao: 4.9,
  totalAvaliacoes: 127,
  servicos: [
    { id: 1, nome: "Corte Masculino", descricao: "", preco: 45, duracao: 30 },
    { id: 2, nome: "Barba", descricao: "", preco: 35, duracao: 20 },
    { id: 3, nome: "Corte + Barba", descricao: "", preco: 70, duracao: 45 },
    { id: 4, nome: "Sobrancelha", descricao: "", preco: 15, duracao: 10 },
    { id: 5, nome: "Pigmentação", descricao: "", preco: 80, duracao: 40 },
    { id: 6, nome: "Hidratação", descricao: "", preco: 50, duracao: 30 },
  ],
  profissionais: [
    { id: 1, nome: "Carlos Silva", foto: "/placeholder.svg", especialidade: "Cortes Modernos" },
    { id: 2, nome: "André Santos", foto: "/placeholder.svg", especialidade: "Barbas" },
    { id: 3, nome: "Lucas Oliveira", foto: "/placeholder.svg", especialidade: "Degradê" },
  ]
}

function parseHHMM(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim())
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

function formatHHMM(minutes: number): string {
  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`
}

// Gerar horários disponíveis em incrementos de 30 min entre abertura e fechamento.
function gerarHorarios(open: string, close: string, stepMinutes = 30): string[] {
  const openMin = parseHHMM(open)
  const closeMin = parseHHMM(close)
  if (openMin === null || closeMin === null) return []
  if (closeMin <= openMin) return []

  const out: string[] = []
  for (let t = openMin; t < closeMin; t += stepMinutes) {
    out.push(formatHHMM(t))
  }
  return out
}

// Gerar próximos 14 dias
const gerarDias = () => {
  const dias = []
  const hoje = new Date()
  for (let i = 0; i < 14; i++) {
    const data = new Date(hoje)
    data.setDate(hoje.getDate() + i)
    dias.push(data)
  }
  return dias
}

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Data local YYYY-MM-DD (evita trocar o dia com toISOString em UTC). */
function toYMDLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function pushRemindersOkSessionKey(slug: string) {
  return `trimtime_push_reminders_ok_v1_${slug}`
}

type ClienteAgendamento = {
  id: string
  nome: string
  email: string
  telefone: string
  photo_url?: string | null
  cpf?: string | null
}

type PublicUnit = {
  id: string
  name: string
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  cep: string | null
}

type PublicShopPayload = {
  id: string
  name: string
  slug: string
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  cep: string | null
  opening_hours?: BarbershopSettings["opening_hours"] | null
  units: PublicUnit[]
  services: { id: string; name: string; description?: string; price: number; duration: number }[]
  barbers: { id: string; name: string; phone: string | null; photo_url?: string | null; photo_position?: number }[]
}

type CurrentPublicAppointmentPayload = {
  appointment: null | {
    client_id: string
    client_name: string
    date: string
    time: string
    barber_id: string
    barber_name: string
    unit_id: string | null
    unit_name: string | null
    services: { id: string; name: string; duration: number; price: number }[]
    appointment_ids: string[]
    total_price: number
    total_duration: number
  }
}

export default function BarbeariaPage() {
  const params = useParams()
  const slug = (params?.slug as string) || "trim-time"
  const storageSuffix = `_${slug}`

  const [authPhase, setAuthPhase] = useState<"loading" | "cadastro" | "login" | "logado">("loading")
  const [clienteLogado, setClienteLogado] = useState<ClienteAgendamento | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  const [etapa, setEtapa] = useState(1)
  const [servicosSelecionados, setServicosSelecionados] = useState<string[]>([])
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<string | null>(null)
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null)
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null)
  const [dadosCliente, setDadosCliente] = useState({
    nome: "",
    telefone: "",
    email: "",
    cpf: "",
    foto: "",
    fotoPosicao: 50,
  })
  const [dadosSalvosMsg, setDadosSalvosMsg] = useState<string | null>(null)
  const [fotoConfigOpen, setFotoConfigOpen] = useState(false)
  const [fotoEditDraft, setFotoEditDraft] = useState("")
  const [fotoEditPos, setFotoEditPos] = useState(50)
  const [fotoModalErr, setFotoModalErr] = useState<string | null>(null)
  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState(false)
  const [bookingSummary, setBookingSummary] = useState<PersistedClientBookingV1 | null>(null)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [erroAgendamento, setErroAgendamento] = useState("")
  const [trimPlayStage, setTrimPlayStage] = useState<"intro" | "splash" | "game">("intro")
  const [trimPlayCliente, setTrimPlayCliente] = useState<null | { id: string; nome: string }>(null)
  const [pushReminderMsg, setPushReminderMsg] = useState<string | null>(null)
  const [pushReminderBusy, setPushReminderBusy] = useState(false)
  /** Após ativar com sucesso, some o bloco de lembretes (só barra Olá / Sair). */
  const [pushRemindersActivated, setPushRemindersActivated] = useState(false)

  // Cadastro (nome + telefone; fluxo simples)
  const [formCadastro, setFormCadastro] = useState({ nome: "", telefone: "" })
  const [erroCadastro, setErroCadastro] = useState("")

  // Login simples: telefone + nome. Legado: e-mail/telefone + senha
  const [formLogin, setFormLogin] = useState({ telefone: "", nome: "" })
  const [loginLegacy, setLoginLegacy] = useState(false)
  const [formLoginLegacy, setFormLoginLegacy] = useState({ emailOuTelefone: "", senha: "" })
  const [showSenhaLogin, setShowSenhaLogin] = useState(false)
  const [erroLogin, setErroLogin] = useState("")

  /** Dados públicos da barbearia (API) — nome, contato, unidades */
  const [publicMeta, setPublicMeta] = useState<PublicShopPayload | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [occupiedTimes, setOccupiedTimes] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/public/barbershops/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PublicShopPayload | null) => {
        if (!cancelled && data?.name) setPublicMeta(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    const units = publicMeta?.units
    if (!units?.length) return
    if (units.length === 1) {
      setSelectedUnitId(units[0].id)
      return
    }
    if (typeof window === "undefined") return
    const saved = sessionStorage.getItem(`trimtime_unit_${slug}`)
    if (saved && units.some((u) => u.id === saved)) {
      setSelectedUnitId(saved)
    }
  }, [publicMeta, slug])

  useEffect(() => {
    const forceAccountUi =
      typeof window !== "undefined" && /[?&](conta|signup|login)=1(?:&|$)/i.test(window.location.search)
    let cancelled = false

    fetch(`/api/public/barbershops/${encodeURIComponent(slug)}/auth/session`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : { client: null }))
      .then((data: { client?: ClienteAgendamento | null }) => {
        if (cancelled) return
        const c = data?.client ?? null
        if (c) {
          setClienteLogado(c)
          setAuthPhase("logado")
          const saved = loadSavedClientProfile(slug)
          setDadosCliente({
            nome: c.nome,
            telefone: c.telefone,
            email: c.email,
            cpf: c.cpf ? formatCpfDisplay(c.cpf) : "",
            foto: c.photo_url?.trim() || saved?.foto?.trim() || "",
            fotoPosicao: saved?.fotoPosicao ?? 50,
          })
          return
        }
        if (forceAccountUi) {
          setAuthPhase("cadastro")
          return
        }
        setClienteLogado(null)
        setAuthPhase("logado")
      })
      .catch(() => {
        if (cancelled) return
        setClienteLogado(null)
        setAuthPhase(forceAccountUi ? "cadastro" : "logado")
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  /** Lembrete push já ativado nesta aba — esconde o botão após refresh. */
  useEffect(() => {
    if (typeof window === "undefined" || authPhase !== "logado" || !clienteLogado) return
    try {
      if (sessionStorage.getItem(pushRemindersOkSessionKey(slug)) === "1") {
        setPushRemindersActivated(true)
      }
    } catch {
      /* ignore */
    }
  }, [authPhase, clienteLogado, slug])

  /** Convidado: preenche com dados salvos neste aparelho (nome, telefone, e-mail, CPF, foto). */
  useEffect(() => {
    if (authPhase !== "logado" || clienteLogado) return
    const saved = loadSavedClientProfile(slug)
    if (!saved) return
    setDadosCliente((prev) => ({
      ...prev,
      nome: prev.nome || saved.nome || "",
      telefone: prev.telefone || saved.telefone || "",
      email: prev.email || saved.email || "",
      cpf: prev.cpf || (saved.cpf ? formatCpfDisplay(saved.cpf) : "") || "",
      ...(saved.foto && !prev.foto
        ? { foto: saved.foto, fotoPosicao: saved.fotoPosicao ?? 50 }
        : {}),
    }))
  }, [authPhase, clienteLogado, slug])

  /** Reabrir o link: restaura resumo; tela cheia ou modo navegação conforme uiFocus salvo */
  useEffect(() => {
    if (authPhase !== "logado") return
    const p = loadConfirmedBooking(slug)
    if (!p) {
      setBookingSummary(null)
      return
    }

    if (clienteLogado) {
      const idMatch = p.clienteId === clienteLogado.id
      const phoneMatch =
        typeof p.clientPhoneDigits === "string" &&
        p.clientPhoneDigits.length >= 10 &&
        clientPhonesMatch(p.clientPhoneDigits, clienteLogado.telefone)
      if (!idMatch && !phoneMatch) {
        setBookingSummary(null)
        setAgendamentoConfirmado(false)
        return
      }
    } else if (p.bookedWithoutLogin === false) {
      /** Confirmado logado, sessão sumiu: só mostra se o telefone salvo neste aparelho bater. */
      const saved = loadSavedClientProfile(slug)
      const phoneOk =
        typeof p.clientPhoneDigits === "string" &&
        p.clientPhoneDigits.length >= 10 &&
        saved?.telefone &&
        clientPhonesMatch(p.clientPhoneDigits, saved.telefone)
      if (!phoneOk) {
        setBookingSummary(null)
        setAgendamentoConfirmado(false)
        return
      }
    }

    setBookingSummary(p)
    /** Sem uiFocus salvo: tela principal com card (jogo / remarcar / ver confirmação), não etapa 1. */
    const focus = p.uiFocus ?? "browsing"
    if (focus === "browsing") {
      setAgendamentoConfirmado(false)
      setTrimPlayStage("intro")
      setEtapa(1)
    } else {
      setAgendamentoConfirmado(true)
      setTrimPlayStage("intro")
    }

    if (clienteLogado) {
      const saved = loadSavedClientProfile(slug)
      setDadosCliente((prev) => ({
        nome: p.nomeExibicao || clienteLogado.nome,
        telefone: clienteLogado.telefone,
        email: clienteLogado.email,
        cpf: clienteLogado.cpf ? formatCpfDisplay(clienteLogado.cpf) : "",
        foto:
          clienteLogado.photo_url?.trim() ||
          prev.foto?.trim() ||
          saved?.foto?.trim() ||
          "",
        fotoPosicao: prev.fotoPosicao ?? saved?.fotoPosicao ?? 50,
      }))
    } else {
      setDadosCliente((prev) => ({
        ...prev,
        nome: p.nomeExibicao || prev.nome,
        telefone: prev.telefone,
        email: prev.email,
        foto: prev.foto,
      }))
    }
  }, [authPhase, clienteLogado, slug])

  /**
   * Fallback de restauração: se não houver resumo local, busca agendamento ativo no servidor.
   * Isso evita abrir direto no fluxo 1-4 quando o cliente já tem horário.
   */
  useEffect(() => {
    if (authPhase !== "logado" || bookingSummary) return
    let cancelled = false

    const savedProfile = loadSavedClientProfile(slug)
    const phoneHint = clienteLogado?.telefone || dadosCliente.telefone || savedProfile?.telefone || ""
    const query =
      clientPhoneDigits(phoneHint).length >= 10 ? `?phone=${encodeURIComponent(phoneHint)}` : ""

    fetch(`/api/public/barbershops/${encodeURIComponent(slug)}/appointments/current${query}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CurrentPublicAppointmentPayload | null) => {
        if (cancelled) return
        const appt = data?.appointment
        if (!appt) return

        const next: PersistedClientBookingV1 = {
          v: 1,
          clienteId: appt.client_id,
          confirmedAt: new Date().toISOString(),
          unitId: appt.unit_id,
          unitName: appt.unit_name,
          dataIso: `${appt.date}T12:00:00`,
          horario: appt.time.slice(0, 5),
          profissionalId: appt.barber_id,
          profissionalNome: appt.barber_name,
          servicos: appt.services.map((s) => ({
            id: s.id,
            nome: s.name,
            preco: Number(s.price ?? 0),
            duracao: Number(s.duration ?? 0),
          })),
          nomeExibicao: appt.client_name || clienteLogado?.nome || dadosCliente.nome || "Cliente",
          totalPreco: Number(appt.total_price ?? 0),
          totalDuracao: Number(appt.total_duration ?? 0),
          clientPhoneDigits: clientPhoneDigits(phoneHint) || null,
          bookedWithoutLogin: !clienteLogado,
          appointmentIds: Array.isArray(appt.appointment_ids) ? appt.appointment_ids : undefined,
          uiFocus: "browsing",
        }

        saveConfirmedBooking(slug, next)
        setBookingSummary(next)
        setAgendamentoConfirmado(false)
        setTrimPlayStage("intro")
        setEtapa(1)
        setDadosCliente((prev) => ({
          ...prev,
          nome: prev.nome || next.nomeExibicao,
          telefone: prev.telefone || phoneHint,
        }))
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [authPhase, bookingSummary, clienteLogado, dadosCliente.nome, dadosCliente.telefone, slug])

  useEffect(() => {
    if (!agendamentoConfirmado) return
    setTrimPlayStage("intro")

    if (clienteLogado) {
      setTrimPlayCliente({ id: clienteLogado.id, nome: clienteLogado.nome })
      return
    }

    if (typeof window === "undefined") return
    const key = `trimplay_game_cliente_${slug}`
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as { id: string; nome: string }
        if (parsed?.id && parsed?.nome) {
          setTrimPlayCliente({ id: parsed.id, nome: parsed.nome })
          return
        }
      }
    } catch {
      // ignore
    }

    const id = `gp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const nome = dadosCliente.nome?.trim() || "Cliente"
    const payload = { id, nome }
    try {
      localStorage.setItem(key, JSON.stringify(payload))
    } catch {
      // ignore
    }
    setTrimPlayCliente(payload)
  }, [agendamentoConfirmado, clienteLogado, dadosCliente.nome, slug])

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (numbers.length <= 2) return value
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const formatCpfInput = (value: string) =>
    formatCpfDisplay(value.replace(/\D/g, "").slice(0, 11))

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroCadastro("")
    setAuthLoading(true)
    const digits = formCadastro.telefone.replace(/\D/g, "")
    if (digits.length < 10) {
      setErroCadastro("Informe um telefone válido com DDD")
      setAuthLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/public/barbershops/${encodeURIComponent(slug)}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nome: formCadastro.nome.trim(),
          telefone: formCadastro.telefone,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; client?: ClienteAgendamento }
      if (!res.ok || !data.client) {
        setErroCadastro(data.error || "Não foi possível criar sua conta")
        return
      }
      setClienteLogado(data.client)
      setDadosCliente({
        nome: data.client.nome,
        telefone: data.client.telefone,
        email: data.client.email,
        cpf: data.client.cpf ? formatCpfDisplay(data.client.cpf) : "",
        foto: data.client.photo_url ?? "",
        fotoPosicao: 50,
      })
      setAuthPhase("logado")
    } catch {
      setErroCadastro("Erro ao criar conta. Tente novamente.")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroLogin("")
    setAuthLoading(true)
    try {
      const body = loginLegacy
        ? {
            emailOuTelefone: formLoginLegacy.emailOuTelefone.trim(),
            senha: formLoginLegacy.senha,
          }
        : {
            telefone: formLogin.telefone.trim(),
            nome: formLogin.nome.trim(),
          }
      if (!loginLegacy && formLogin.telefone.replace(/\D/g, "").length < 10) {
        setErroLogin("Informe um telefone válido com DDD")
        setAuthLoading(false)
        return
      }
      const res = await fetch(`/api/public/barbershops/${encodeURIComponent(slug)}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; client?: ClienteAgendamento }
      if (!res.ok || !data.client) {
        setErroLogin(data.error || "Email/telefone ou senha incorretos")
        return
      }
      setClienteLogado(data.client)
      setDadosCliente({
        nome: data.client.nome,
        telefone: data.client.telefone,
        email: data.client.email,
        cpf: data.client.cpf ? formatCpfDisplay(data.client.cpf) : "",
        foto: data.client.photo_url ?? "",
        fotoPosicao: 50,
      })
      setAuthPhase("logado")
    } catch {
      setErroLogin("Erro ao entrar. Tente novamente.")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch(`/api/public/barbershops/${encodeURIComponent(slug)}/push-subscribe`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {})
    await fetch(`/api/public/barbershops/${encodeURIComponent(slug)}/auth/session`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {})
    setClienteLogado(null)
    setAuthPhase("cadastro")
    setEtapa(1)
    setServicosSelecionados([])
    setProfissionalSelecionado(null)
    setDataSelecionada(null)
    setHorarioSelecionado(null)
    setDadosCliente({ nome: "", telefone: "", email: "", cpf: "", foto: "", fotoPosicao: 50 })
    setPushReminderMsg(null)
    setPushRemindersActivated(false)
    try {
      sessionStorage.removeItem(pushRemindersOkSessionKey(slug))
    } catch {
      /* ignore */
    }
    setBookingSummary(null)
    setAgendamentoConfirmado(false)
    setTrimPlayStage("intro")
  }

  const msgLembretesIndisponivel =
    "Lembretes por notificação não estão disponíveis neste momento. Seu agendamento funciona normalmente."

  const ativarLembretesPush = async () => {
    setPushReminderMsg(null)
    setPushReminderBusy(true)
    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushReminderMsg("Este navegador não permite ativar lembretes assim. Você pode continuar o agendamento.")
        return
      }
      const pkRes = await fetch("/api/public/push/vapid-public-key")
      if (!pkRes.ok) {
        await pkRes.json().catch(() => ({}))
        setPushReminderMsg(msgLembretesIndisponivel)
        return
      }
      const { publicKey } = (await pkRes.json()) as { publicKey?: string }
      if (!publicKey) {
        setPushReminderMsg(msgLembretesIndisponivel)
        return
      }
      const perm = await Notification.requestPermission()
      if (perm !== "granted") {
        setPushReminderMsg("Permissão negada. Se mudar de ideia, ative notificações nas configurações do navegador.")
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      const json = sub.toJSON()
      const saveRes = await fetch(`/api/public/barbershops/${encodeURIComponent(slug)}/push-subscribe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: json }),
      })
      await saveRes.json().catch(() => ({}))
      if (!saveRes.ok) {
        setPushReminderMsg("Não foi possível concluir agora. Tente de novo mais tarde.")
        return
      }
      try {
        sessionStorage.setItem(pushRemindersOkSessionKey(slug), "1")
      } catch {
        /* ignore */
      }
      setPushRemindersActivated(true)
      setPushReminderMsg(null)
    } catch {
      setPushReminderMsg("Algo deu errado ao ativar. Você pode tentar de novo depois.")
    } finally {
      setPushReminderBusy(false)
    }
  }

  const entrarComoConvidado = () => {
    setClienteLogado(null)
    setAuthPhase("logado")
    setDadosCliente((prev) => ({
      nome: prev.nome || "",
      telefone: prev.telefone || "",
      email: prev.email || "",
      cpf: prev.cpf || "",
      foto: prev.foto || "",
      fotoPosicao: prev.fotoPosicao ?? 50,
    }))
    setEtapa(1)
    setServicosSelecionados([])
    setProfissionalSelecionado(null)
    setDataSelecionada(null)
    setHorarioSelecionado(null)
    setAgendamentoConfirmado(false)
    setBookingSummary(null)
    setTrimPlayStage("intro")
    setErroAgendamento("")
  }

  const barbearia = {
    ...barbeariaData,
    nome: publicMeta?.name ?? barbeariaData.nome,
    telefone: publicMeta?.phone ?? barbeariaData.telefone,
    servicos:
      publicMeta?.services?.length
        ? publicMeta.services.map((service) => ({
            id: service.id,
            nome: service.name,
            descricao: (service.description ?? "").trim(),
            preco: service.price,
            duracao: service.duration,
          }))
        : barbeariaData.servicos.map((service) => ({
            ...service,
            id: String(service.id),
            descricao: service.descricao ?? "",
          })),
    profissionais:
      publicMeta?.barbers?.length
        ? publicMeta.barbers.map((barber) => ({
            id: barber.id,
            nome: barber.name,
            foto: barber.photo_url || "/placeholder.svg",
            fotoPosition: barber.photo_position ?? 50,
            especialidade: barber.phone ? `Contato: ${barber.phone}` : "Profissional",
          }))
        : barbeariaData.profissionais.map((barber) => ({ ...barber, id: String(barber.id) })),
  }
  const dias = gerarDias()
  const openingHours = openingHoursFromSettings(publicMeta?.opening_hours ?? undefined)
  const dayKeyByIndex = [
    "domingo",
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
  ] as const

  const dayKeyFromDate = (d: Date) => dayKeyByIndex[d.getDay()]

  const horarios = (() => {
    if (!dataSelecionada) return []
    const key = dayKeyFromDate(dataSelecionada)
    const day = openingHours[key]
    if (!day?.ativo) return []
    return gerarHorarios(day.abertura, day.fechamento)
  })()

  const selectedUnit =
    publicMeta?.units?.find((u) => u.id === selectedUnitId) ?? null
  const displayNome = publicMeta?.name ?? barbeariaData.nome
  const fotoClienteHeader =
    clienteLogado?.photo_url?.trim() || dadosCliente.foto?.trim() || ""
  const displayPhone =
    selectedUnit?.phone ?? publicMeta?.phone ?? null
  const displayAddress =
    selectedUnit?.address ?? publicMeta?.address ?? null
  const cityStateUnit = [selectedUnit?.city, selectedUnit?.state]
    .filter(Boolean)
    .join(" - ")
  const cityStateBase = [publicMeta?.city, publicMeta?.state]
    .filter(Boolean)
    .join(" - ")
  const displayCityLine = cityStateUnit || cityStateBase || null
  const needsUnitChoice = !!(publicMeta?.units && publicMeta.units.length > 1)
  /** Com resumo de agendamento ativo, só o card de gestão (remarcar / jogo); sem etapas nem rodapé de novo agendamento. */
  const showAgendamentoWizard = !bookingSummary

  const displayHorarioFuncionamento = (() => {
    const short: Record<(typeof dayKeyByIndex)[number], string> = {
      segunda: "Seg",
      terca: "Ter",
      quarta: "Qua",
      quinta: "Qui",
      sexta: "Sex",
      sabado: "Sáb",
      domingo: "Dom",
    }

    const order = [...dayKeyByIndex]
    const segments: string[] = []

    let i = 0
    while (i < order.length) {
      const key = order[i]
      const day = openingHours[key]
      if (!day?.ativo) {
        i++
        continue
      }

      const open = day.abertura
      const close = day.fechamento
      let j = i + 1
      while (j < order.length) {
        const k = order[j]
        const dk = openingHours[k]
        if (!dk?.ativo || dk.abertura !== open || dk.fechamento !== close) break
        j++
      }

      const start = short[order[i]]
      const end = short[order[j - 1]]
      const label = j - i >= 2 ? `${start}-${end}` : start

      const fmtHour = (t: string) => {
        const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
        if (!m) return t
        const hh = Number(m[1])
        return Number.isNaN(hh) ? t : `${hh}h`
      }

      segments.push(`${label}: ${fmtHour(open)} às ${fmtHour(close)}`)
      i = j
    }

    return segments.length ? segments.join(" · ") : null
  })()

  const persistUnit = (id: string) => {
    setSelectedUnitId(id)
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`trimtime_unit_${slug}`, id)
    }
  }

  useEffect(() => {
    if (!publicMeta) {
      setOccupiedTimes([])
      return
    }
    if (!dataSelecionada || !profissionalSelecionado) {
      setOccupiedTimes([])
      return
    }
    const date = toYMDLocal(dataSelecionada)
    let cancelled = false
    const unitQ =
      selectedUnitId != null && selectedUnitId !== ""
        ? `&unit_id=${encodeURIComponent(selectedUnitId)}`
        : ""
    fetch(
      `/api/public/barbershops/${encodeURIComponent(slug)}/appointments?date=${encodeURIComponent(date)}&barber_id=${encodeURIComponent(profissionalSelecionado)}${unitQ}`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : { occupied_times: [] }))
      .then((data: { occupied_times?: string[] }) => {
        if (!cancelled) setOccupiedTimes(Array.isArray(data.occupied_times) ? data.occupied_times : [])
      })
      .catch(() => {
        if (!cancelled) setOccupiedTimes([])
      })
    return () => {
      cancelled = true
    }
  }, [dataSelecionada, profissionalSelecionado, slug, selectedUnitId, publicMeta])

  useEffect(() => {
    if (horarioSelecionado && occupiedTimes.includes(horarioSelecionado)) {
      setHorarioSelecionado(null)
    }
  }, [horarioSelecionado, occupiedTimes])

  const toggleServico = (id: string) => {
    setServicosSelecionados(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const servicosSelecionadosData = barbearia.servicos.filter(s => servicosSelecionados.includes(s.id))
  const totalPreco = servicosSelecionadosData.reduce((acc, s) => acc + s.preco, 0)
  const totalDuracao = servicosSelecionadosData.reduce((acc, s) => acc + s.duracao, 0)

  const profissionalData = barbearia.profissionais.find(p => p.id === profissionalSelecionado)

  const podeAvancar = () => {
    switch (etapa) {
      case 1: {
        if (needsUnitChoice && !selectedUnitId) return false
        return servicosSelecionados.length > 0
      }
      case 2: return profissionalSelecionado !== null
      case 3: return dataSelecionada !== null && horarioSelecionado !== null
      case 4: return publicMeta !== null && dadosCliente.nome.trim() !== "" && dadosCliente.telefone.trim() !== ""
      default: return false
    }
  }

  const confirmarAgendamento = async () => {
    if (!dataSelecionada || !horarioSelecionado || profissionalSelecionado === null) return
    if (!publicMeta) {
      setErroAgendamento("Não foi possível carregar a barbearia. Atualize a página e tente novamente.")
      return
    }
    const cpfNorm = cpfDigits(dadosCliente.cpf)
    if (dadosCliente.cpf.trim() && !cpfNorm) {
      setErroAgendamento("CPF inválido: use 11 dígitos ou deixe em branco.")
      return
    }
    const prof = barbearia.profissionais.find((p) => p.id === profissionalSelecionado)
    if (!prof) return
    setBookingLoading(true)
    setErroAgendamento("")
    try {
      const res = await fetch(`/api/public/barbershops/${encodeURIComponent(slug)}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          barber_id: profissionalSelecionado,
          service_ids: servicosSelecionados,
          date: toYMDLocal(dataSelecionada),
          time: horarioSelecionado,
          unit_id: selectedUnitId,
          client: {
            nome: dadosCliente.nome,
            telefone: dadosCliente.telefone,
            email: dadosCliente.email,
            cpf: cpfNorm ?? undefined,
            photo_url: dadosCliente.foto.trim() ? dadosCliente.foto : undefined,
          },
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        client?: ClienteAgendamento
        appointment_ids?: string[]
      }
      if (!res.ok) {
        setErroAgendamento(data.error || "Não foi possível confirmar seu agendamento")
        return
      }
      if (data.client) {
        setClienteLogado(data.client)
      }
      const digitsTel = clientPhoneDigits(
        dadosCliente.telefone || data.client?.telefone || clienteLogado?.telefone || ""
      )
      const summary: PersistedClientBookingV1 = {
        v: 1,
        clienteId: data.client?.id ?? clienteLogado?.id ?? `guest_${Date.now()}`,
        confirmedAt: new Date().toISOString(),
        unitId: selectedUnitId,
        unitName: selectedUnit?.name ?? null,
        dataIso: `${toYMDLocal(dataSelecionada)}T12:00:00`,
        horario: horarioSelecionado,
        profissionalId: profissionalSelecionado,
        profissionalNome: prof.nome,
        servicos: servicosSelecionadosData.map((s) => ({
          id: s.id,
          nome: s.nome,
          preco: s.preco,
          duracao: s.duracao,
        })),
        nomeExibicao: dadosCliente.nome.trim() || data.client?.nome || clienteLogado?.nome || "Cliente",
        totalPreco,
        totalDuracao,
        clientPhoneDigits: digitsTel.length >= 10 ? digitsTel : null,
        bookedWithoutLogin: !clienteLogado,
        appointmentIds: Array.isArray(data.appointment_ids) ? data.appointment_ids : undefined,
        uiFocus: "confirmation",
      }
      saveConfirmedBooking(slug, summary)
      setBookingSummary(summary)
      setAgendamentoConfirmado(true)
    } catch {
      setErroAgendamento("Erro ao confirmar agendamento. Tente novamente.")
    } finally {
      setBookingLoading(false)
    }
  }

  const remarcarAgendamento = () => {
    void (async () => {
      setErroAgendamento("")
      const summary = bookingSummary ?? loadConfirmedBooking(slug)
      const payload: { appointment_ids?: string[]; date?: string; telefone?: string } = {}
      if (summary?.appointmentIds?.length) {
        payload.appointment_ids = summary.appointmentIds
      } else if (summary?.dataIso) {
        payload.date = toYMDLocal(new Date(summary.dataIso))
      }
      const tel =
        dadosCliente.telefone?.trim() ||
        loadSavedClientProfile(slug)?.telefone?.trim() ||
        ""
      if (tel) payload.telefone = tel
      if (payload.appointment_ids?.length || payload.date) {
        try {
          const res = await fetch(
            `/api/public/barbershops/${encodeURIComponent(slug)}/appointments/cancel`,
            {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          )
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          if (!res.ok) {
            setErroAgendamento(
              body.error ||
                "Não foi possível liberar seu horário anterior. Tente de novo ou fale com a barbearia."
            )
            return
          }
        } catch {
          setErroAgendamento("Sem conexão. Verifique a internet e tente novamente.")
          return
        }
      }
      clearConfirmedBooking(slug)
      setBookingSummary(null)
      setAgendamentoConfirmado(false)
      setTrimPlayStage("intro")
      setEtapa(3)
      setDataSelecionada(null)
      setHorarioSelecionado(null)
    })()
  }

  /** Volta ao início do agendamento mantendo o resumo salvo (reabre app / link e vê o card + pode jogar de novo). */
  const concluirParaInicio = () => {
    const base = bookingSummary ?? loadConfirmedBooking(slug)
    if (base) {
      const next: PersistedClientBookingV1 = { ...base, uiFocus: "browsing" }
      saveConfirmedBooking(slug, next)
      setBookingSummary(next)
    }
    setAgendamentoConfirmado(false)
    setTrimPlayStage("intro")
    setEtapa(1)
    setServicosSelecionados([])
    setProfissionalSelecionado(null)
    setDataSelecionada(null)
    setHorarioSelecionado(null)
  }

  const verConfirmacaoEJogo = (irDiretoProJogo: boolean) => {
    setAgendamentoConfirmado(true)
    setTrimPlayStage(irDiretoProJogo ? "splash" : "intro")
  }

  const barbershopId = publicMeta?.id ?? ""

  /** Sempre no mesmo “slot” do React — não desmonta ao mudar loading → logado (evita sumir o modal PWA). */
  const clientBookingInstallPrompt = (
    <AppInstallPrompt storageSuffix={storageSuffix} variant="clientBooking" />
  )

  // —— Telas de acesso: loading, cadastro, login ——
  if (authPhase === "loading") {
    return (
      <>
        {clientBookingInstallPrompt}
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </>
    )
  }

  if (authPhase === "cadastro") {
    return (
      <>
        {clientBookingInstallPrompt}
        <div className="min-h-screen bg-background">
        <div className="h-32 bg-gradient-to-r from-primary/30 to-primary/10" />
        <div className="max-w-md mx-auto px-4 -mt-8">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-center mb-4">
                <img src={barbearia.logo} alt="" className="w-14 h-14 rounded-xl object-contain bg-background" />
              </div>
              <h1 className="text-xl font-bold text-foreground text-center mb-1">Cadastre-se (opcional)</h1>
              <p className="text-sm text-muted-foreground text-center mb-6">
                {displayNome} — só nome e WhatsApp para continuar
              </p>
              <form onSubmit={handleCadastro} className="space-y-4">
                {erroCadastro && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {erroCadastro}
                  </div>
                )}
                <div>
                  <Label className="text-foreground">Nome completo</Label>
                  <Input
                    value={formCadastro.nome}
                    onChange={(e) => setFormCadastro((p) => ({ ...p, nome: e.target.value }))}
                    placeholder="Seu nome"
                    className="mt-1 bg-card border-border"
                    required
                  />
                </div>
                <div>
                  <Label className="text-foreground">Telefone (WhatsApp)</Label>
                  <Input
                    value={formCadastro.telefone}
                    onChange={(e) => setFormCadastro((p) => ({ ...p, telefone: formatPhone(e.target.value) }))}
                    placeholder="(00) 00000-0000"
                    className="mt-1 bg-card border-border"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {authLoading ? "Criando conta..." : "Criar conta e continuar"}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Já tem conta?{" "}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setAuthPhase("login")}
                >
                  Entrar
                </button>
              </p>

              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-border text-foreground hover:bg-secondary"
                  onClick={entrarComoConvidado}
                >
                  Agendar sem conta
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </>
    )
  }

  if (authPhase === "login") {
    return (
      <>
        {clientBookingInstallPrompt}
        <div className="min-h-screen bg-background">
        <div className="h-32 bg-gradient-to-r from-primary/30 to-primary/10" />
        <div className="max-w-md mx-auto px-4 -mt-8">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-center mb-4">
                <img src={barbearia.logo} alt="" className="w-14 h-14 rounded-xl object-contain bg-background" />
              </div>
              <h1 className="text-xl font-bold text-foreground text-center mb-1">Entrar</h1>
              <p className="text-sm text-muted-foreground text-center mb-6">
                {loginLegacy
                  ? "Conta criada antes com e-mail e senha"
                  : "Mesmo telefone e nome do cadastro"}
              </p>
              <form onSubmit={handleLogin} className="space-y-4">
                {erroLogin && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {erroLogin}
                  </div>
                )}
                {!loginLegacy ? (
                  <>
                    <div>
                      <Label className="text-foreground">Telefone</Label>
                      <Input
                        value={formLogin.telefone}
                        onChange={(e) => setFormLogin((p) => ({ ...p, telefone: formatPhone(e.target.value) }))}
                        placeholder="(00) 00000-0000"
                        className="mt-1 bg-card border-border"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-foreground">Nome completo</Label>
                      <Input
                        value={formLogin.nome}
                        onChange={(e) => setFormLogin((p) => ({ ...p, nome: e.target.value }))}
                        placeholder="Igual ao cadastro"
                        className="mt-1 bg-card border-border"
                        autoComplete="name"
                        required
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label className="text-foreground">E-mail ou telefone</Label>
                      <Input
                        value={formLoginLegacy.emailOuTelefone}
                        onChange={(e) =>
                          setFormLoginLegacy((p) => ({ ...p, emailOuTelefone: e.target.value }))
                        }
                        placeholder="seu@email.com ou (11) 99999-9999"
                        className="mt-1 bg-card border-border"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-foreground">Senha</Label>
                      <div className="relative">
                        <Input
                          type={showSenhaLogin ? "text" : "password"}
                          value={formLoginLegacy.senha}
                          onChange={(e) => setFormLoginLegacy((p) => ({ ...p, senha: e.target.value }))}
                          placeholder="Sua senha"
                          className="mt-1 bg-card border-border pr-10"
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowSenhaLogin(!showSenhaLogin)}
                        >
                          {showSenhaLogin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <Button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {authLoading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-2 underline-offset-2 hover:underline"
                onClick={() => {
                  setErroLogin("")
                  setLoginLegacy((v) => !v)
                }}
              >
                {loginLegacy ? "Voltar para telefone e nome" : "Conta antiga com senha?"}
              </button>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Não tem conta?{" "}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setAuthPhase("cadastro")}
                >
                  Cadastre-se
                </button>
              </p>

              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-border text-foreground hover:bg-secondary"
                  onClick={entrarComoConvidado}
                >
                  Agendar sem conta
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </>
    )
  }

  if (agendamentoConfirmado) {
    if (trimPlayStage === "splash") {
      return <TrimPlaySplash onComplete={() => setTrimPlayStage("game")} />
    }
    if (trimPlayStage === "game") {
      if (!barbershopId || !trimPlayCliente) {
        return (
          <div className="min-h-screen bg-black flex items-center justify-center p-4 text-white">
            Carregando Trim Play…
          </div>
        )
      }
      return (
        <TrimPlayGame
          barbershopId={barbershopId}
          clienteId={trimPlayCliente.id}
          clienteNome={trimPlayCliente.nome}
          onExit={() => setTrimPlayStage("intro")}
        />
      )
    }

    const resumoData = bookingSummary ? new Date(bookingSummary.dataIso) : null

    return (
      <>
        {clientBookingInstallPrompt}
        <div className="min-h-screen bg-black flex items-center justify-center p-4 text-white">
        <Card className="max-w-md w-full bg-black border-[#FFD700]/35 shadow-none max-h-[min(100dvh-2rem,720px)] overflow-y-auto">
          <CardContent className="p-6 sm:p-8 text-left">
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-[#FFD700]/15 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#FFD700]/25">
                <Check className="w-8 h-8 text-[#FFD700]" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#FFD700]">Agendamento confirmado</h1>
              <p className="text-white/55 text-xs mt-1">
                {bookingSummary
                  ? `Confirmado em ${new Date(bookingSummary.confirmedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                  : null}
              </p>
            </div>

            {bookingSummary && resumoData ? (
              <div className="space-y-3 mb-6 text-sm border border-[#FFD700]/20 rounded-xl p-4 bg-white/[0.03]">
                <div className="flex gap-3">
                  <Calendar className="w-5 h-5 text-[#FFD700] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white/50 text-xs">Data e horário</p>
                    <p className="text-white font-medium">
                      {diasSemana[resumoData.getDay()]}, {resumoData.getDate()} de {meses[resumoData.getMonth()]} às{" "}
                      {bookingSummary.horario}
                    </p>
                  </div>
                </div>
                {bookingSummary.unitName ? (
                  <div className="flex gap-3">
                    <Building2 className="w-5 h-5 text-[#FFD700] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white/50 text-xs">Unidade</p>
                      <p className="text-white font-medium">{bookingSummary.unitName}</p>
                    </div>
                  </div>
                ) : null}
                <div className="flex gap-3">
                  <Scissors className="w-5 h-5 text-[#FFD700] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white/50 text-xs">Serviços</p>
                    <p className="text-white font-medium">{bookingSummary.servicos.map((s) => s.nome).join(", ")}</p>
                    <p className="text-[#FFD700]/80 text-xs mt-1">
                      {bookingSummary.totalDuracao} min · R$ {bookingSummary.totalPreco}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarFallback className="bg-[#FFD700]/20 text-[#FFD700] text-sm">
                      {bookingSummary.profissionalNome
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-white/50 text-xs">Profissional</p>
                    <p className="text-white font-medium">{bookingSummary.profissionalNome}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-white/75 text-sm text-center mb-6">
                Seu horário está reservado. Jogue o Trim Play enquanto espera!
              </p>
            )}

            <p className="text-white/70 text-sm text-center mb-4">
              🎮 Suba no ranking da barbearia — pontuação salva mesmo offline.
            </p>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => setTrimPlayStage("splash")}
                className="w-full bg-[#FFD700] text-black hover:opacity-95 font-semibold"
              >
                Jogar Trim Play
              </Button>
              <Button
                variant="outline"
                onClick={remarcarAgendamento}
                className="w-full border-[#FFD700]/40 text-[#FFD700] hover:bg-[#FFD700]/10"
              >
                Remarcar agendamento
              </Button>
              <Button
                variant="outline"
                onClick={concluirParaInicio}
                className="w-full border-[#FFD700]/40 text-[#FFD700] hover:bg-[#FFD700]/10"
              >
                Concluir
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </>
    )
  }

  return (
    <>
      {clientBookingInstallPrompt}
      <div className="min-h-screen bg-background">
      {/* Barra: Sair */}
      {clienteLogado && (
        <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-sm text-muted-foreground truncate">
              Olá, {clienteLogado.nome.split(" ")[0]}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-1" />
              Sair
            </Button>
          </div>
          {!pushRemindersActivated ? (
            <div className="px-4 pb-2 flex flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto border-border text-foreground"
                disabled={pushReminderBusy}
                onClick={() => void ativarLembretesPush()}
              >
                <Bell className="w-4 h-4 mr-2" />
                {pushReminderBusy ? "Ativando…" : "Receber lembretes neste celular"}
              </Button>
              {pushReminderMsg ? (
                <p className="text-xs text-muted-foreground">{pushReminderMsg}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {/* Header da Barbearia */}
      <div className="relative">
        <div className="px-4 pt-4 pb-2 text-center max-w-2xl mx-auto">
          <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">{displayNome}</h1>
        </div>
        <div className="h-28 sm:h-32 bg-gradient-to-r from-primary/30 to-primary/10" />
        <div className="max-w-2xl mx-auto px-4 -mt-11 sm:-mt-12">
          <div className="flex items-end gap-4 mb-4">
            <div className="w-24 h-24 rounded-xl bg-background border-4 border-background overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-border/40">
              {authPhase === "logado" && fotoClienteHeader ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fotoClienteHeader}
                  alt=""
                  className="h-full w-full object-cover object-center"
                  style={{ objectPosition: `center ${dadosCliente.fotoPosicao}%` }}
                  decoding="async"
                />
              ) : (
                <img src={barbearia.logo} alt="Logo Trim Time" className="w-[5.25rem] h-[5.25rem] object-contain bg-background" />
              )}
            </div>
            <div className="pb-2 min-w-0 flex-1 text-left">
              {clienteLogado ? (
                <>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                    Olá, {clienteLogado.nome.trim().split(/\s+/).filter(Boolean)[0] ?? "cliente"}
                  </h2>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mt-0.5 flex-wrap">
                    <Star className="w-4 h-4 text-primary fill-primary shrink-0" />
                    <span>{barbearia.avaliacao}</span>
                    <span>({barbearia.totalAvaliacoes} avaliações)</span>
                  </div>
                </>
              ) : bookingSummary ? (
                <>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                    Olá,{" "}
                    {bookingSummary.nomeExibicao.trim().split(/\s+/).filter(Boolean)[0] ?? "cliente"}
                  </h2>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mt-0.5 flex-wrap">
                    <Star className="w-4 h-4 text-primary fill-primary shrink-0" />
                    <span>{barbearia.avaliacao}</span>
                    <span>({barbearia.totalAvaliacoes} avaliações)</span>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">Agende seu horário</h2>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mt-0.5 flex-wrap">
                    <Star className="w-4 h-4 text-primary fill-primary shrink-0" />
                    <span>{barbearia.avaliacao}</span>
                    <span>({barbearia.totalAvaliacoes} avaliações)</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              {displayAddress ? (
                <span className="block text-foreground/90">{displayAddress}</span>
              ) : null}
              <span>{displayCityLine}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
            {displayPhone ? (
              <a
                href={`tel:${displayPhone.replace(/\D/g, "")}`}
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <Phone className="w-4 h-4 shrink-0" />
                {displayPhone}
              </a>
            ) : null}
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{displayHorarioFuncionamento ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {needsUnitChoice ? (
        <div className="max-w-2xl mx-auto px-4 mb-6">
          <Card className="border-primary/20 bg-card/80">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-foreground font-medium text-sm">
                <Building2 className="w-4 h-4 text-primary" />
                Escolha a unidade
              </div>
              <p className="text-xs text-muted-foreground">
                O agendamento será vinculado à unidade selecionada.
              </p>
              <select
                className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                value={selectedUnitId ?? ""}
                onChange={(e) => persistUnit(e.target.value)}
              >
                <option value="">Selecione…</option>
                {publicMeta!.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {authPhase === "logado" && bookingSummary && !agendamentoConfirmado ? (
        <div className="max-w-2xl mx-auto px-4 mb-6 space-y-3">
          {erroAgendamento ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {erroAgendamento}
            </div>
          ) : null}
          <Card className="border-primary/25 bg-card/90">
            <CardContent className="p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                  <Calendar className="w-5 h-5 text-primary shrink-0" />
                  Remarcar agendamento
                </div>
                <p className="text-sm text-foreground font-medium mt-2">
                  {(() => {
                    const d = new Date(bookingSummary.dataIso)
                    return `${diasSemana[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} às ${bookingSummary.horario}`
                  })()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {bookingSummary.servicos.map((s) => s.nome).join(", ")} · {bookingSummary.profissionalNome}
                  {bookingSummary.unitName ? ` · ${bookingSummary.unitName}` : ""}
                </p>
              </div>

              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div>
                  <p className="text-base sm:text-lg font-bold text-foreground leading-snug">
                    Meu projeto Trim Time Play
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enquanto espera o dia do corte, jogue e suba no ranking da barbearia.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-primary/40 text-foreground hover:bg-primary/10"
                  onClick={() => verConfirmacaoEJogo(true)}
                >
                  Abrir Trim Time Play
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-0">
                <Button
                  type="button"
                  className="w-full sm:flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={remarcarAgendamento}
                >
                  Remarcar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:flex-1 border-border text-foreground hover:bg-secondary"
                  onClick={() => verConfirmacaoEJogo(false)}
                >
                  Ver confirmação
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {showAgendamentoWizard ? (
      <>
      {/* Indicador de Etapas */}
      <div className="max-w-2xl mx-auto px-4 mb-6">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                ${etapa >= step 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-muted-foreground'
                }`}
              >
                {etapa > step ? <Check className="w-4 h-4" /> : step}
              </div>
              {step < 4 && (
                <div className={`w-12 sm:w-20 h-1 mx-1 transition-colors
                  ${etapa > step ? 'bg-primary' : 'bg-secondary'}`} 
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Serviços</span>
          <span>Profissional</span>
          <span>Horário</span>
          <span>Confirmar</span>
        </div>
      </div>

      {/* Conteúdo das Etapas */}
      <div className="max-w-2xl mx-auto px-4 pb-32">
        
        {/* Etapa 1: Escolher Serviços */}
        {etapa === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Escolha os serviços</h2>
            <div className="grid gap-3">
              {barbearia.servicos.map((servico) => (
                <Card 
                  key={servico.id}
                  className={`cursor-pointer transition-all border-2 ${
                    servicosSelecionados.includes(servico.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:border-primary/30'
                  }`}
                  onClick={() => toggleServico(servico.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                        ${servicosSelecionados.includes(servico.id) 
                          ? 'border-primary bg-primary' 
                          : 'border-muted-foreground'
                        }`}
                      >
                        {servicosSelecionados.includes(servico.id) && (
                          <Check className="w-3 h-3 text-primary-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="font-medium text-foreground">{servico.nome}</p>
                        <p className="text-sm text-muted-foreground">{servico.duracao} min</p>
                        {servico.descricao?.trim() ? (
                          <p className="text-sm text-muted-foreground/90 mt-1 whitespace-pre-wrap">
                            {servico.descricao.trim()}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-primary font-semibold">R$ {servico.preco}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Etapa 2: Escolher Profissional */}
        {etapa === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Escolha o profissional</h2>
            <div className="grid gap-3">
              {barbearia.profissionais.map((profissional) => (
                <Card 
                  key={profissional.id}
                  className={`cursor-pointer transition-all border-2 ${
                    profissionalSelecionado === profissional.id
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:border-primary/30'
                  }`}
                  onClick={() => setProfissionalSelecionado(profissional.id)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <Avatar className="w-14 h-14 border-2 border-primary/20">
                      <AvatarImage src={profissional.foto} style={{ objectPosition: `center ${'fotoPosition' in profissional ? profissional.fotoPosition : 50}%` }} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {profissional.nome.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{profissional.nome}</p>
                      <p className="text-sm text-muted-foreground">{profissional.especialidade}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                      ${profissionalSelecionado === profissional.id 
                        ? 'border-primary bg-primary' 
                        : 'border-muted-foreground'
                      }`}
                    >
                      {profissionalSelecionado === profissional.id && (
                        <Check className="w-4 h-4 text-primary-foreground" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Etapa 3: Escolher Data e Horário */}
        {etapa === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Escolha a data e horário</h2>
            
            {/* Seleção de Data */}
            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-3">Data</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {dias.map((dia, index) => {
                  const isHoje = index === 0
                  const isSelecionado = dataSelecionada?.toDateString() === dia.toDateString()
                  const key = dayKeyFromDate(dia)
                  const isFechado = openingHours[key]?.ativo !== true
                  
                  return (
                    <button
                      key={index}
                      disabled={isFechado}
                      onClick={() => setDataSelecionada(dia)}
                      className={`flex-shrink-0 w-16 py-3 rounded-lg text-center transition-all ${
                        isFechado 
                          ? 'bg-secondary/50 text-muted-foreground/50 cursor-not-allowed'
                          : isSelecionado
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card hover:bg-primary/10 text-foreground'
                      }`}
                    >
                      <p className="text-xs mb-1">{isHoje ? 'Hoje' : diasSemana[dia.getDay()]}</p>
                      <p className="text-lg font-semibold">{dia.getDate()}</p>
                      <p className="text-xs">{meses[dia.getMonth()]}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Seleção de Horário */}
            {dataSelecionada && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">Horário</p>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {horarios.map((horario) => {
                    const isSelecionado = horarioSelecionado === horario
                    const isOcupado = occupiedTimes.includes(horario)
                    
                    return (
                      <button
                        key={horario}
                        disabled={isOcupado}
                        onClick={() => setHorarioSelecionado(horario)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          isOcupado
                            ? 'bg-secondary/50 text-muted-foreground/50 cursor-not-allowed'
                            : isSelecionado
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card hover:bg-primary/10 text-foreground'
                        }`}
                      >
                        {horario}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Etapa 4: Confirmar Dados */}
        {etapa === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Confirme seus dados</h2>
            
            {/* Resumo do Agendamento */}
            <Card className="mb-6 border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Data e Horário</p>
                    <p className="font-medium text-foreground">
                      {dataSelecionada && `${diasSemana[dataSelecionada.getDay()]}, ${dataSelecionada.getDate()} de ${meses[dataSelecionada.getMonth()]}`} às {horarioSelecionado}
                    </p>
                  </div>
                </div>

                {selectedUnit ? (
                  <div className="flex items-center gap-3 pb-3 border-b border-border">
                    <Building2 className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Unidade</p>
                      <p className="font-medium text-foreground">{selectedUnit.name}</p>
                    </div>
                  </div>
                ) : null}
                
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <Scissors className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Serviços</p>
                    <p className="font-medium text-foreground">
                      {servicosSelecionadosData.map(s => s.nome).join(', ')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {profissionalData?.nome.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm text-muted-foreground">Profissional</p>
                    <p className="font-medium text-foreground">{profissionalData?.nome}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Formulário do Cliente */}
            <div className="space-y-4">
              {erroAgendamento ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {erroAgendamento}
                </div>
              ) : null}
              <div>
                <Label htmlFor="nome" className="text-foreground">Seu nome</Label>
                <Input
                  id="nome"
                  placeholder="Digite seu nome completo"
                  value={dadosCliente.nome}
                  onChange={(e) => setDadosCliente(prev => ({ ...prev, nome: e.target.value }))}
                  className="mt-1 bg-card border-border focus:border-primary"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-foreground">E-mail (opcional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={dadosCliente.email}
                  onChange={(e) => setDadosCliente(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1 bg-card border-border focus:border-primary"
                />
              </div>
              <div>
                <Label htmlFor="telefone" className="text-foreground">Telefone (obrigatório)</Label>
                <Input
                  id="telefone"
                  placeholder="(00) 00000-0000"
                  value={dadosCliente.telefone}
                  onChange={(e) => setDadosCliente(prev => ({ ...prev, telefone: formatPhone(e.target.value) }))}
                  className="mt-1 bg-card border-border focus:border-primary"
                />
              </div>
              <div>
                <Label htmlFor="cpf-cliente" className="text-foreground">CPF (opcional)</Label>
                <Input
                  id="cpf-cliente"
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  autoComplete="off"
                  value={dadosCliente.cpf}
                  onChange={(e) =>
                    setDadosCliente((prev) => ({ ...prev, cpf: formatCpfInput(e.target.value) }))
                  }
                  className="mt-1 bg-card border-border focus:border-primary"
                />
              </div>
              <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
                <p className="text-xs text-muted-foreground leading-snug">
                  Salve nome, telefone, e-mail e CPF neste aparelho para não digitar de novo no próximo
                  agendamento. A senha da conta não é guardada aqui (por segurança).
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="secondary"
                    className="border border-border"
                    onClick={() => {
                      saveSavedClientProfile(slug, {
                        nome: dadosCliente.nome,
                        telefone: dadosCliente.telefone,
                        email: dadosCliente.email,
                        cpf: dadosCliente.cpf.replace(/\D/g, "").slice(0, 11),
                        foto: dadosCliente.foto || undefined,
                        fotoPosicao: dadosCliente.fotoPosicao,
                      })
                      setDadosSalvosMsg("Dados salvos neste aparelho.")
                      window.setTimeout(() => setDadosSalvosMsg(null), 4000)
                    }}
                  >
                    Salvar meus dados neste aparelho
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      clearSavedClientProfile(slug)
                      setDadosSalvosMsg("Dados salvos neste aparelho foram apagados.")
                      window.setTimeout(() => setDadosSalvosMsg(null), 4000)
                    }}
                  >
                    Esquecer dados salvos
                  </Button>
                </div>
                {dadosSalvosMsg ? (
                  <p className="text-xs text-primary font-medium">{dadosSalvosMsg}</p>
                ) : null}
              </div>
              <div>
                <p className="text-sm font-medium leading-none text-foreground">Sua foto (opcional)</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full border-border text-foreground hover:bg-secondary sm:w-auto"
                  onClick={() => {
                    setFotoModalErr(null)
                    setFotoEditDraft(dadosCliente.foto)
                    setFotoEditPos(dadosCliente.fotoPosicao)
                    setFotoConfigOpen(true)
                  }}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {dadosCliente.foto ? "Ajustar foto" : "Adicionar foto"}
                </Button>
                {dadosCliente.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dadosCliente.foto}
                    alt=""
                    className="mt-2 h-16 w-16 rounded-full border border-border object-cover object-center"
                    style={{ objectPosition: `center ${dadosCliente.fotoPosicao}%` }}
                    decoding="async"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ajuda o profissional a reconhecê-lo na agenda.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Fixo com Resumo e Botão */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
        <div className="max-w-2xl mx-auto">
          {servicosSelecionados.length > 0 && (
            <div className="flex items-center justify-between mb-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{servicosSelecionados.length} serviço(s)</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{totalDuracao} min</span>
              </div>
              <span className="text-primary font-bold text-lg">R$ {totalPreco}</span>
            </div>
          )}
          
          <div className="flex gap-3">
            {etapa > 1 && (
              <Button
                variant="outline"
                onClick={() => setEtapa(etapa - 1)}
                className="border-border text-foreground hover:bg-secondary"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            )}
            
            <Button
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!podeAvancar() || bookingLoading}
              onClick={() => {
                if (etapa < 4) {
                  setEtapa(etapa + 1)
                } else {
                  void confirmarAgendamento()
                }
              }}
            >
              {etapa === 4 ? (bookingLoading ? 'Confirmando...' : 'Confirmar Agendamento') : 'Continuar'}
              {etapa < 4 && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
      </>
      ) : null}

      <Dialog
        open={fotoConfigOpen}
        onOpenChange={(open) => {
          setFotoConfigOpen(open)
          if (!open) setFotoModalErr(null)
        }}
      >
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sua foto no perfil</DialogTitle>
          </DialogHeader>
          {fotoModalErr ? (
            <p className="text-sm text-destructive">{fotoModalErr}</p>
          ) : null}
          <input
            id="foto-cliente-modal-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (!f) return
              void compressImageToJpegDataUrl(f)
                .then((url) => {
                  if (url.length > MAX_PROFILE_PHOTO_DATA_URL_CHARS) {
                    setFotoModalErr("Imagem grande demais. Tente outra.")
                    return
                  }
                  setFotoModalErr(null)
                  setFotoEditDraft(url)
                })
                .catch(() => setFotoModalErr("Não foi possível ler a imagem."))
            }}
          />
          <div className="flex flex-col items-center gap-3 py-2">
            {fotoEditDraft ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fotoEditDraft}
                alt=""
                className="h-24 w-24 rounded-full border-2 border-primary/40 object-cover object-center shadow"
                style={{ objectPosition: `center ${fotoEditPos}%` }}
                decoding="async"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-border bg-secondary">
                <Camera className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            {fotoEditDraft ? (
              <div className="w-full space-y-1">
                <p className="text-center text-xs text-muted-foreground">Ajustar posição</p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={fotoEditPos}
                  onChange={(e) => setFotoEditPos(Number(e.target.value))}
                  className="w-full cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Topo</span>
                  <span>Base</span>
                </div>
              </div>
            ) : null}
            <label
              htmlFor="foto-cliente-modal-file"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Camera className="h-4 w-4" />
              {fotoEditDraft ? "Trocar foto" : "Escolher foto"}
            </label>
            {fotoEditDraft ? (
              <button
                type="button"
                className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                onClick={() => {
                  setFotoEditDraft("")
                  setFotoEditPos(50)
                }}
              >
                Remover foto
              </button>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFotoConfigOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setDadosCliente((prev) => ({
                  ...prev,
                  foto: fotoEditDraft,
                  fotoPosicao: fotoEditPos,
                }))
                setFotoConfigOpen(false)
              }}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  )
}
