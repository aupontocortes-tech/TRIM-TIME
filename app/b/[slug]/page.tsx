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
  Smartphone
} from "lucide-react"
import {
  getClienteLogado,
  cadastrarCliente,
  loginCliente,
  logoutCliente,
  type ClienteAgendamento,
} from "@/lib/cliente-auth"

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

// Gerar horários disponíveis
const gerarHorarios = () => {
  const horarios = []
  for (let h = 9; h <= 19; h++) {
    horarios.push(`${h.toString().padStart(2, '0')}:00`)
    if (h < 19) horarios.push(`${h.toString().padStart(2, '0')}:30`)
  }
  return horarios
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

export default function BarbeariaPage() {
  const params = useParams()
  const slug = (params?.slug as string) || "trim-time"

  const [authPhase, setAuthPhase] = useState<"loading" | "cadastro" | "login" | "logado">("loading")
  const [clienteLogado, setClienteLogado] = useState<ClienteAgendamento | null>(null)

  const [etapa, setEtapa] = useState(1)
  const [servicosSelecionados, setServicosSelecionados] = useState<number[]>([])
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<number | null>(null)
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null)
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null)
  const [dadosCliente, setDadosCliente] = useState({ nome: "", telefone: "", email: "" })
  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState(false)

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

  // PWA install
  const [showPwaBanner, setShowPwaBanner] = useState(false)

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
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true
    const visited = typeof window !== "undefined" && sessionStorage.getItem("trimtime_pwa_banner_seen")
    if (!isStandalone && !visited && typeof window !== "undefined") {
      setShowPwaBanner(true)
    }
  }, [])

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

  const dismissPwaBanner = () => {
    setShowPwaBanner(false)
    if (typeof window !== "undefined") sessionStorage.setItem("trimtime_pwa_banner_seen", "1")
  }

  const barbearia = barbeariaData
  const horarios = gerarHorarios()
  const dias = gerarDias()

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
      case 1: return servicosSelecionados.length > 0
      case 2: return profissionalSelecionado !== null
      case 3: return dataSelecionada !== null && horarioSelecionado !== null
      case 4: return dadosCliente.nome.trim() !== "" && dadosCliente.telefone.trim() !== ""
      default: return false
    }
  }

  const confirmarAgendamento = () => {
    setAgendamentoConfirmado(true)
  }

  // —— Telas de acesso: loading, cadastro, login ——
  if (authPhase === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-muted-foreground">Carregando...</div>
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
                <img src={barbearia.logo} alt="" className="w-14 h-14 rounded-xl object-contain" />
              </div>
              <h1 className="text-xl font-bold text-foreground text-center mb-1">Cadastre-se</h1>
              <p className="text-sm text-muted-foreground text-center mb-6">
                {barbearia.nome} — preencha para agendar
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
                <img src={barbearia.logo} alt="" className="w-14 h-14 rounded-xl object-contain" />
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
      </div>
    )
  }

  if (agendamentoConfirmado) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-primary/20">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Agendamento Confirmado!</h1>
            <p className="text-muted-foreground mb-6">
              Seu horário foi reservado com sucesso
            </p>
            
            <div className="bg-secondary/50 rounded-lg p-4 text-left space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Barbearia</span>
                <span className="text-foreground font-medium">{barbearia.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profissional</span>
                <span className="text-foreground font-medium">{profissionalData?.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data</span>
                <span className="text-foreground font-medium">
                  {dataSelecionada && `${dataSelecionada.getDate()} de ${meses[dataSelecionada.getMonth()]}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horário</span>
                <span className="text-foreground font-medium">{horarioSelecionado}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-primary font-bold">R$ {totalPreco}</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-6">
              Você receberá uma confirmação no WhatsApp
            </p>

            <Button 
              onClick={() => window.location.reload()}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Fazer Novo Agendamento
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Barra: Sair + PWA */}
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
      {showPwaBanner && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone className="w-5 h-5 text-primary flex-shrink-0" />
            <p className="text-sm text-foreground">
              Adicione ao celular: abra o menu do navegador (⋮) e toque em &quot;Adicionar à tela inicial&quot; ou &quot;Instalar app&quot;.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={dismissPwaBanner} className="flex-shrink-0">
            Ok
          </Button>
        </div>
      )}

      {/* Header da Barbearia */}
      <div className="relative">
        <div className="h-32 bg-gradient-to-r from-primary/30 to-primary/10" />
        <div className="max-w-2xl mx-auto px-4 -mt-12">
          <div className="flex items-end gap-4 mb-4">
            <div className="w-24 h-24 rounded-xl bg-card border-4 border-background overflow-hidden flex items-center justify-center shrink-0">
              <img src={barbearia.logo} alt="Logo Trim Time" className="w-16 h-16 object-contain" />
            </div>
            <div className="pb-2">
              <h1 className="text-2xl font-bold text-foreground">{barbearia.nome}</h1>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Star className="w-4 h-4 text-primary fill-primary" />
                <span>{barbearia.avaliacao}</span>
                <span>({barbearia.totalAvaliacoes} avaliações)</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{barbearia.cidade}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{barbearia.horarioFuncionamento}</span>
            </div>
          </div>
        </div>
      </div>

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
                  const isDomingo = dia.getDay() === 0
                  
                  return (
                    <button
                      key={index}
                      disabled={isDomingo}
                      onClick={() => setDataSelecionada(dia)}
                      className={`flex-shrink-0 w-16 py-3 rounded-lg text-center transition-all ${
                        isDomingo 
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
                    // Simular alguns horários indisponíveis
                    const indisponivel = ['10:00', '14:30', '16:00'].includes(horario)
                    const isSelecionado = horarioSelecionado === horario
                    
                    return (
                      <button
                        key={horario}
                        disabled={indisponivel}
                        onClick={() => setHorarioSelecionado(horario)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          indisponivel
                            ? 'bg-secondary/50 text-muted-foreground/50 cursor-not-allowed line-through'
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
