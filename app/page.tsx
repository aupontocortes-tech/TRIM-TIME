"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Scissors, 
  Calendar, 
  TrendingUp, 
  Users, 
  Clock, 
  Shield,
  Bell,
  ChevronRight,
  Star,
  Check,
  Menu,
  X
} from "lucide-react"
import { PLAN_PRICES, PLAN_LABELS, PLAN_FEATURES } from "@/lib/plans"
import { BrandLogo } from "@/components/brand-logo"
import { TrimTimeWordmark } from "@/components/trim-time-wordmark"

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-[5.5rem] md:min-h-[7.5rem] py-2 md:py-3">
            <Link href="/" className="flex items-center gap-3 sm:gap-4 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary rounded-lg transition-opacity hover:opacity-90">
              <BrandLogo size="hero" priority />
              <TrimTimeWordmark className="text-2xl sm:text-3xl md:text-4xl shrink-0 leading-none" />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <Link href="#funcionalidades" className="text-muted-foreground hover:text-primary transition-colors">
                Funcionalidades
              </Link>
              <Link href="#planos" className="text-muted-foreground hover:text-primary transition-colors">
                Planos
              </Link>
              <Link href="#depoimentos" className="text-muted-foreground hover:text-primary transition-colors">
                Depoimentos
              </Link>
            </nav>

<div className="hidden md:flex items-center gap-4">
                <Link href="/login">
                  <Button variant="ghost" className="text-foreground hover:text-primary">
                    Sou Barbeiro
                  </Button>
                </Link>
              <Link href="/cadastro?tipo=barbearia">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Começar Agora
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-background border-b border-border">
            <div className="px-4 py-4 space-y-4">
              <Link 
                href="#funcionalidades" 
                className="block text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Funcionalidades
              </Link>
              <Link 
                href="#planos" 
                className="block text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Planos
              </Link>
              <Link 
                href="#depoimentos" 
                className="block text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Depoimentos
              </Link>
<div className="flex flex-col gap-2 pt-4 border-t border-border">
                    <Link href="/login">
                      <Button variant="ghost" className="w-full text-foreground hover:text-primary">
                        Sou Barbeiro
                      </Button>
                    </Link>
                <Link href="/cadastro?tipo=barbearia">
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    Começar Agora
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="pt-40 md:pt-44 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Star className="w-4 h-4 text-primary" />
                <span className="text-sm text-primary">+500 barbearias confiam no Trim Time</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
                <span className="text-balance">Sua barbearia com agendamento</span>{" "}
                <span className="text-primary">profissional</span>
              </h1>
              
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 text-pretty">
                Crie sua conta, receba seu <span className="text-primary font-medium">link exclusivo</span> e compartilhe com seus clientes. 
                O cliente entra no link, escolhe o serviço, o horário e confirma. 
                Você vê tudo na sua agenda: horário, cliente, serviço e detalhes do agendamento.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/cadastro?tipo=barbearia">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
                    Criar minha conta
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="#funcionalidades">
                  <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary w-full sm:w-auto">
                    Ver Funcionalidades
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-8 mt-10 justify-center lg:justify-start">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">98%</p>
                  <p className="text-sm text-muted-foreground">Satisfação</p>
                </div>
                <div className="h-10 w-px bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">+10k</p>
                  <p className="text-sm text-muted-foreground">Agendamentos/mês</p>
                </div>
                <div className="h-10 w-px bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">24/7</p>
                  <p className="text-sm text-muted-foreground">Suporte</p>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full max-w-lg lg:max-w-none">
              <div className="relative">
                <div className="absolute -inset-4 bg-primary/20 rounded-3xl blur-3xl opacity-30" />
                <Card className="relative bg-card border-border overflow-hidden">
                  <CardContent className="p-0">
                    <div className="bg-secondary/50 px-4 py-3 border-b border-border flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Agenda do Dia</span>
                      <span className="text-xs text-muted-foreground">Sua visão como barbeiro — Hoje, 15 de março</span>
                    </div>
                    <div className="p-4 space-y-3">
                      {[
                        { time: "09:00", client: "Carlos Silva", service: "Corte + Barba", status: "confirmed" },
                        { time: "10:00", client: "João Pedro", service: "Corte Degradê", status: "confirmed" },
                        { time: "11:00", client: "Rafael Santos", service: "Barba", status: "pending" },
                        { time: "14:00", client: "Lucas Oliveira", service: "Corte Social", status: "confirmed" },
                      ].map((appointment, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 border border-border/50">
                          <div className="text-center min-w-[50px]">
                            <p className="text-sm font-semibold text-primary">{appointment.time}</p>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{appointment.client}</p>
                            <p className="text-xs text-muted-foreground">{appointment.service}</p>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${appointment.status === 'confirmed' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funcionalidades" className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Tudo que você precisa para <span className="text-primary">crescer</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Funcionalidades pensadas para facilitar o dia a dia da sua barbearia
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Calendar,
                title: "Seu Link Exclusivo",
                description: "Receba um link (trimtime.com/b/sua-barbearia) e compartilhe com seus clientes. O cliente entra, escolhe serviço e horário, e agenda. Você tem acesso à agenda com horário, nome do cliente e tudo sobre cada agendamento."
              },
              {
                icon: TrendingUp,
                title: "Gestão Financeira",
                description: "Controle de faturamento, relatórios de vendas diárias e mensais. Saiba exatamente quanto sua barbearia está faturando."
              },
              {
                icon: Users,
                title: "Gestão de Clientes",
                description: "Histórico completo de cada cliente, preferências, frequência de visitas e muito mais."
              },
              {
                icon: Clock,
                title: "Controle de Horários",
                description: "Defina seus horários de trabalho, folgas e pausas. O sistema organiza automaticamente."
              },
              {
                icon: Shield,
                title: "Segurança Total",
                description: "Seus dados protegidos com a mais alta tecnologia. Backups automáticos e criptografia."
              },
              {
                icon: Scissors,
                title: "Multi-Barbeiros",
                description: "Adicione quantos profissionais precisar. Cada um com sua própria agenda e comissões."
              },
              {
                icon: Bell,
                title: "Lembretes e confirmações automáticas",
                description: "O cliente recebe lembretes antes do horário marcado para não esquecer do agendamento. Confirmação automática ao agendar e opção de lembrete por push, e-mail ou WhatsApp, reduzindo faltas e deixando sua agenda mais previsível."
              }
            ].map((feature, i) => (
              <Card key={i} className="bg-card border-border hover:border-primary/50 transition-colors group">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - Planos que cabem no seu bolso */}
      <section id="planos" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4">
              Para Barbeiros
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Planos que cabem no seu <span className="text-primary">bolso</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Você paga, seus clientes agendam grátis pelo seu link exclusivo
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Plano Básico - borda azul */}
            <Card className="bg-card border-2 border-blue-500">
              <CardContent className="p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground mb-1">{PLAN_LABELS.basic}</h3>
                  <p className="text-sm text-muted-foreground">Para começar</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-blue-600">R${PLAN_PRICES.basic}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {PLAN_FEATURES.basic.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/cadastro?plano=basic">
                  <Button variant="outline" className="w-full border-blue-500 text-blue-600 hover:bg-blue-500/10">
                    Assinar Básico
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Plano Pro - Mais Popular - borda amarela */}
            <Card className="bg-card border-2 border-amber-500 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 bg-amber-500 text-white text-xs font-medium rounded-full">
                  Mais Popular
                </span>
              </div>
              <CardContent className="p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground mb-1">{PLAN_LABELS.pro}</h3>
                  <p className="text-sm text-muted-foreground">Para crescer</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-primary">R${PLAN_PRICES.pro}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {PLAN_FEATURES.pro.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/cadastro?plano=pro">
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    Assinar Pro
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Plano Premium - borda verde */}
            <Card className="bg-card border-2 border-green-600 relative">
              <CardContent className="p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground mb-1">{PLAN_LABELS.premium}</h3>
                  <p className="text-sm text-muted-foreground">Tudo que você precisa</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-green-600">R${PLAN_PRICES.premium}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {PLAN_FEATURES.premium.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/cadastro?plano=premium">
                  <Button variant="outline" className="w-full border-green-600 text-green-600 hover:bg-green-600/10">
                    Assinar Premium
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8 space-y-2">
            <p className="text-muted-foreground text-sm">
              Escolha o plano ideal para sua barbearia.
            </p>
            <p className="text-xs text-muted-foreground">
              Seus clientes não pagam nada — recebem seu link, entram e fazem o agendamento. Você vê horário e detalhes na sua agenda.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="depoimentos" className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              O que nossos clientes <span className="text-primary">dizem</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Marcos Barbosa",
                role: "Dono da Barbearia Elite",
                content: "O Trim Time transformou minha barbearia. Antes eu perdia muito tempo com agendamentos por telefone, agora tudo é automático."
              },
              {
                name: "Fernando Costa",
                role: "Barbeiro Autônomo",
                content: "A gestão financeira me ajudou a entender melhor meu negócio. Agora sei exatamente quanto estou faturando."
              },
              {
                name: "Ricardo Almeida",
                role: "Rede de Barbearias RA",
                content: "Gerenciar 3 unidades nunca foi tão fácil. O suporte é incrível e sempre estão prontos para ajudar."
              }
            ].map((testimonial, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-foreground mb-4">{`"${testimonial.content}"`}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-semibold">{testimonial.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-primary/10 rounded-3xl blur-3xl opacity-50" />
            <div className="relative bg-card border border-border rounded-2xl p-8 sm:p-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Pronto para transformar sua barbearia?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Junte-se a mais de 500 barbearias que já usam o Trim Time para crescer seus negócios.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/cadastro?tipo=barbearia">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
                    Criar minha conta
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/contato">
                  <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary w-full sm:w-auto">
                    Falar com um Especialista
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-3 mb-4 w-fit focus:outline-none focus:ring-2 focus:ring-primary rounded-lg transition-opacity hover:opacity-90">
                <BrandLogo size="lg" />
              </Link>
              <p className="text-sm text-muted-foreground">
                A plataforma completa para gestão de barbearias.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#funcionalidades" className="hover:text-primary transition-colors">Funcionalidades</Link></li>
                <li><Link href="#planos" className="hover:text-primary transition-colors">Preços</Link></li>
                <li><Link href="/b/trim-time" className="hover:text-primary transition-colors">Para Clientes (exemplo de agendamento)</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/sobre" className="hover:text-primary transition-colors">Sobre</Link></li>
                <li><Link href="/contato" className="hover:text-primary transition-colors">Contato</Link></li>
                <li><Link href="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/termos" className="hover:text-primary transition-colors">Termos de Uso</Link></li>
                <li><Link href="/privacidade" className="hover:text-primary transition-colors">Privacidade</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-12 pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Trim Time. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
