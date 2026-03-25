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
} from "lucide-react"
import {
  getClienteLogado,
  cadastrarCliente,
  loginCliente,
  logoutCliente,
  type ClienteAgendamento,
} from "@/lib/cliente-auth"
import { openingHoursFromSettings } from "@/lib/barbershop-settings-ui"
import type { BarbershopSettings } from "@/lib/db/types"
import { AppInstallPrompt } from "@/components/app-install-prompt"
import { TrimPlayGame } from "@/components/trim-play/TrimPlayGame"

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
    { id: 1, nome: "Corte Masculino", preco: 45, duracao: 30 },
    { id: 2, nome: "Barba", preco: 35, duracao: 20 },
    { id: 3, nome: "Corte + Barba", preco: 70, duracao: 45 },
    { id: 4, nome: "Sobrancelha", preco: 15, duracao: 10 },
    { id: 5, nome: "Pigmentação", preco: 80, duracao: 40 },
    { id: 6, nome: "Hidratação", preco: 50, duracao: 30 },
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
}

export default function BarbeariaPage() {
  const params = useParams()
  const slug = (params?.slug as string) || "trim-time"
  const storageSuffix = `_${slug}`

  const [authPhase, setAuthPhase] = useState<"loading" | "cadastro" | "login" | "logado">("loading")
  const [clienteLogado, setClienteLogado] = useState<ClienteAgendamento | null>(null)

  const [etapa, setEtapa] = useState(1)
  const [servicosSelecionados, setServicosSelecionados] = useState<number[]>([])
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<number | null>(null)
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null)
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null)
  const [dadosCliente, setDadosCliente] = useState({ nome: "", telefone: "", email: "" })
  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState(false)
  const [trimPlayStage, setTrimPlayStage] = useState<"intro" | "game">("intro")
  const [trimPlayCliente, setTrimPlayCliente] = useState<null | { id: string; nome: string }>(null)

  // Cadastro
  const [formCadastro, setFormCadastro] = useState({
    nome: "",
    email: "",
    telefone: "",
    senha: "",
    confirmarSenha: "",
  })
  const [showSenhaCadastro, setShowSenhaCadastro] = useState(false)
  const [erroCadastro, setErroCadastro] = useState("")

  // Login
  const [formLogin, setFormLogin] = useState({ emailOuTelefone: "", senha: "" })
  const [showSenhaLogin, setShowSenhaLogin] = useState(false)
  const [erroLogin, setErroLogin] = useState("")

  /** Dados públicos da barbearia (API) — nome, contato, unidades */
  const [publicMeta, setPublicMeta] = useState<PublicShopPayload | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)

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
    const c = getClienteLogado(slug)
    if (c) {
      setClienteLogado(c)
      setAuthPhase("logado")
      setDadosCliente({ nome: c.nome, telefone: c.telefone, email: c.email })
    } else {
      setAuthPhase("cadastro")
    }
  }, [slug])

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

  const handleCadastro = (e: React.FormEvent) => {
    e.preventDefault()
    setErroCadastro("")
    if (formCadastro.senha !== formCadastro.confirmarSenha) {
      setErroCadastro("As senhas não coincidem")
      return
    }
    if (formCadastro.senha.length < 6) {
      setErroCadastro("A senha deve ter pelo menos 6 caracteres")
      return
    }
    const cliente = cadastrarCliente(slug, {
      nome: formCadastro.nome,
      email: formCadastro.email,
      telefone: formCadastro.telefone,
      senha: formCadastro.senha,
    })
    setClienteLogado(cliente)
    setDadosCliente({ nome: cliente.nome, telefone: cliente.telefone, email: cliente.email })
    setAuthPhase("logado")
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setErroLogin("")
    const cliente = loginCliente(slug, formLogin.emailOuTelefone, formLogin.senha)
    if (!cliente) {
      setErroLogin("Email/telefone ou senha incorretos")
      return
    }
    setClienteLogado(cliente)
    setDadosCliente({ nome: cliente.nome, telefone: cliente.telefone, email: cliente.email })
    setAuthPhase("logado")
  }

  const handleLogout = () => {
    logoutCliente(slug)
    setClienteLogado(null)
    setAuthPhase("cadastro")
    setEtapa(1)
    setServicosSelecionados([])
    setProfissionalSelecionado(null)
    setDataSelecionada(null)
    setHorarioSelecionado(null)
    setDadosCliente({ nome: "", telefone: "", email: "" })
  }

  const barbearia = barbeariaData
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

  const toggleServico = (id: number) => {
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
      case 4: return dadosCliente.nome.trim() !== "" && dadosCliente.telefone.trim() !== ""
      default: return false
    }
  }

  const confirmarAgendamento = () => {
    setAgendamentoConfirmado(true)
  }

  const barbershopId = publicMeta?.id ?? ""

  // —— Telas de acesso: loading, cadastro, login ——
  if (authPhase === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-muted-foreground">Carregando...</div>
        <AppInstallPrompt storageSuffix={storageSuffix} variant="clientBooking" />
      </div>
    )
  }

  if (authPhase === "cadastro") {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-32 bg-gradient-to-r from-primary/30 to-primary/10" />
        <div className="max-w-md mx-auto px-4 -mt-8">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-center mb-4">
                <img src={barbearia.logo} alt="" className="w-14 h-14 rounded-xl object-contain bg-background" />
              </div>
              <h1 className="text-xl font-bold text-foreground text-center mb-1">Cadastre-se</h1>
              <p className="text-sm text-muted-foreground text-center mb-6">
                {displayNome} — preencha para agendar
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
                  <Label className="text-foreground">E-mail</Label>
                  <Input
                    type="email"
                    value={formCadastro.email}
                    onChange={(e) => setFormCadastro((p) => ({ ...p, email: e.target.value }))}
                    placeholder="seu@email.com"
                    className="mt-1 bg-card border-border"
                    required
                  />
                </div>
                <div>
                  <Label className="text-foreground">Telefone</Label>
                  <Input
                    value={formCadastro.telefone}
                    onChange={(e) => setFormCadastro((p) => ({ ...p, telefone: formatPhone(e.target.value) }))}
                    placeholder="(00) 00000-0000"
                    className="mt-1 bg-card border-border"
                  />
                </div>
                <div>
                  <Label className="text-foreground">Senha</Label>
                  <div className="relative">
                    <Input
                      type={showSenhaCadastro ? "text" : "password"}
                      value={formCadastro.senha}
                      onChange={(e) => setFormCadastro((p) => ({ ...p, senha: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      className="mt-1 bg-card border-border pr-10"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowSenhaCadastro(!showSenhaCadastro)}
                    >
                      {showSenhaCadastro ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-foreground">Confirmar senha</Label>
                  <Input
                    type={showSenhaCadastro ? "text" : "password"}
                    value={formCadastro.confirmarSenha}
                    onChange={(e) => setFormCadastro((p) => ({ ...p, confirmarSenha: e.target.value }))}
                    placeholder="Repita a senha"
                    className="mt-1 bg-card border-border"
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Criar conta e continuar
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
            </CardContent>
          </Card>
        </div>
        <AppInstallPrompt storageSuffix={storageSuffix} variant="clientBooking" />
      </div>
    )
  }

  if (authPhase === "login") {
    return (
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
                Use seu e-mail ou telefone e senha
              </p>
              <form onSubmit={handleLogin} className="space-y-4">
                {erroLogin && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {erroLogin}
                  </div>
                )}
                <div>
                  <Label className="text-foreground">E-mail ou telefone</Label>
                  <Input
                    value={formLogin.emailOuTelefone}
                    onChange={(e) => setFormLogin((p) => ({ ...p, emailOuTelefone: e.target.value }))}
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
                      value={formLogin.senha}
                      onChange={(e) => setFormLogin((p) => ({ ...p, senha: e.target.value }))}
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
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Entrar
                </Button>
              </form>
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
            </CardContent>
          </Card>
        </div>
        <AppInstallPrompt storageSuffix={storageSuffix} variant="clientBooking" />
      </div>
    )
  }

  if (agendamentoConfirmado) {
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

    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 text-white">
        <Card className="max-w-md w-full bg-black border-[#FFD700]/35 shadow-none">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-[#FFD700]/15 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#FFD700]/25">
              <Check className="w-10 h-10 text-[#FFD700]" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-[#FFD700]">💈 Agendamento confirmado!</h1>
            <p className="text-white/80 mb-6">
              ⏳ Enquanto espera, jogue Trim Play e suba no ranking da barbearia!
            </p>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => setTrimPlayStage("game")}
                className="w-full bg-[#FFD700] text-black hover:opacity-95"
              >
                🎮 Jogar Trim Play
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="w-full border-[#FFD700]/40 text-[#FFD700] hover:bg-[#FFD700]/10"
              >
                Voltar
              </Button>
            </div>

            <p className="text-xs text-white/60 mt-4">
              Ranking por barbearia. Pontuação salva mesmo offline.
            </p>
          </CardContent>
        </Card>

        <AppInstallPrompt storageSuffix={storageSuffix} variant="clientBooking" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AppInstallPrompt storageSuffix={storageSuffix} variant="clientBooking" />
      {/* Barra: Sair */}
      {clienteLogado && (
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-background/90 backdrop-blur border-b border-border">
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
      )}

      {/* Header da Barbearia */}
      <div className="relative">
        <div className="h-32 bg-gradient-to-r from-primary/30 to-primary/10" />
        <div className="max-w-2xl mx-auto px-4 -mt-12">
          <div className="flex items-end gap-4 mb-4">
            <div className="w-24 h-24 rounded-xl bg-background border-4 border-background overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-border/40">
              <img src={barbearia.logo} alt="Logo Trim Time" className="w-[5.25rem] h-[5.25rem] object-contain bg-background" />
            </div>
            <div className="pb-2">
              <h1 className="text-2xl font-bold text-foreground">{displayNome}</h1>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Star className="w-4 h-4 text-primary fill-primary" />
                <span>{barbearia.avaliacao}</span>
                <span>({barbearia.totalAvaliacoes} avaliações)</span>
              </div>
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
                      <div>
                        <p className="font-medium text-foreground">{servico.nome}</p>
                        <p className="text-sm text-muted-foreground">{servico.duracao} min</p>
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
                      <AvatarImage src={profissional.foto} />
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
                    
                    return (
                      <button
                        key={horario}
                        disabled={false}
                        onClick={() => setHorarioSelecionado(horario)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          isSelecionado
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
                <Label htmlFor="email" className="text-foreground">E-mail</Label>
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
                <Label htmlFor="telefone" className="text-foreground">WhatsApp</Label>
                <Input
                  id="telefone"
                  placeholder="(00) 00000-0000"
                  value={dadosCliente.telefone}
                  onChange={(e) => setDadosCliente(prev => ({ ...prev, telefone: formatPhone(e.target.value) }))}
                  className="mt-1 bg-card border-border focus:border-primary"
                />
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
              disabled={!podeAvancar()}
              onClick={() => {
                if (etapa < 4) {
                  setEtapa(etapa + 1)
                } else {
                  confirmarAgendamento()
                }
              }}
            >
              {etapa === 4 ? 'Confirmar Agendamento' : 'Continuar'}
              {etapa < 4 && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
