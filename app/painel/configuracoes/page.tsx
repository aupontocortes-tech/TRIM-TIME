"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Store,
  Clock,
  Users,
  Scissors,
  Save,
  Plus,
  Trash2,
  Edit2,
  Link,
  Copy,
  Check,
  Share2,
  QrCode
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Mock data
const dadosBarbearia = {
  nome: "Barbearia Elite",
  slug: "barbearia-elite",
  telefone: "(11) 99999-9999",
  endereco: "Rua das Flores, 123 - Centro",
  cidade: "São Paulo",
  estado: "SP",
  cep: "01310-100"
}

const horariosFuncionamento = {
  segunda: { ativo: true, abertura: "09:00", fechamento: "20:00" },
  terca: { ativo: true, abertura: "09:00", fechamento: "20:00" },
  quarta: { ativo: true, abertura: "09:00", fechamento: "20:00" },
  quinta: { ativo: true, abertura: "09:00", fechamento: "20:00" },
  sexta: { ativo: true, abertura: "09:00", fechamento: "20:00" },
  sabado: { ativo: true, abertura: "09:00", fechamento: "18:00" },
  domingo: { ativo: false, abertura: "09:00", fechamento: "18:00" },
}

const profissionais = [
  { id: 1, nome: "Carlos Silva", email: "carlos@email.com", ativo: true, comissao: 50 },
  { id: 2, nome: "João Pedro", email: "joao@email.com", ativo: true, comissao: 50 },
  { id: 3, nome: "Rafael Santos", email: "rafael@email.com", ativo: true, comissao: 45 },
]

const servicos = [
  { id: 1, nome: "Corte Tradicional", duracao: 30, preco: 35, ativo: true },
  { id: 2, nome: "Corte Degradê", duracao: 40, preco: 45, ativo: true },
  { id: 3, nome: "Barba", duracao: 20, preco: 25, ativo: true },
  { id: 4, nome: "Corte + Barba", duracao: 50, preco: 55, ativo: true },
  { id: 5, nome: "Pigmentação", duracao: 60, preco: 80, ativo: true },
  { id: 6, nome: "Sobrancelha", duracao: 15, preco: 15, ativo: true },
]

const diasSemana = [
  { key: "segunda", label: "Segunda-feira" },
  { key: "terca", label: "Terça-feira" },
  { key: "quarta", label: "Quarta-feira" },
  { key: "quinta", label: "Quinta-feira" },
  { key: "sexta", label: "Sexta-feira" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
]

export default function ConfiguracoesPage() {
  const [barbearia, setBarbearia] = useState(dadosBarbearia)
  const [horarios, setHorarios] = useState(horariosFuncionamento)
  const [listaServicos, setListaServicos] = useState(servicos)
  const [listaProfissionais, setListaProfissionais] = useState(profissionais)
  const [isSaving, setIsSaving] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)

  const linkAgendamento = `trimtime.com/b/${barbearia.slug}`

  const copiarLink = () => {
    navigator.clipboard.writeText(`https://${linkAgendamento}`)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
  }

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
  }

  const toggleDia = (dia: string) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: { ...prev[dia as keyof typeof prev], ativo: !prev[dia as keyof typeof prev].ativo }
    }))
  }

  const toggleServico = (id: number) => {
    setListaServicos(prev => prev.map(s => 
      s.id === id ? { ...s, ativo: !s.ativo } : s
    ))
  }

  const toggleProfissional = (id: number) => {
    setListaProfissionais(prev => prev.map(p => 
      p.id === id ? { ...p, ativo: !p.ativo } : p
    ))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie as configurações da sua barbearia</p>
        </div>
        <Button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      {/* Card do Link de Agendamento */}
      <Card className="bg-gradient-to-r from-primary/20 to-primary/5 border-primary/30">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Link className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-1">Seu Link de Agendamento</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Compartilhe este link com seus clientes para que eles possam agendar
              </p>
              <div className="flex items-center gap-2 p-3 bg-background/50 rounded-lg border border-border">
                <span className="text-primary font-medium flex-1 truncate">{linkAgendamento}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copiarLink}
                  className="border-primary/30 hover:bg-primary/10 flex-shrink-0"
                >
                  {linkCopiado ? (
                    <>
                      <Check className="w-4 h-4 mr-1 text-green-500" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-border">
                <QrCode className="w-4 h-4 mr-2" />
                QR Code
              </Button>
              <Button variant="outline" className="border-border">
                <Share2 className="w-4 h-4 mr-2" />
                Compartilhar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="barbearia" className="space-y-6">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="barbearia" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Store className="w-4 h-4 mr-2" />
            Barbearia
          </TabsTrigger>
          <TabsTrigger value="horarios" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Clock className="w-4 h-4 mr-2" />
            Horários
          </TabsTrigger>
          <TabsTrigger value="servicos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Scissors className="w-4 h-4 mr-2" />
            Serviços
          </TabsTrigger>
          <TabsTrigger value="equipe" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4 mr-2" />
            Equipe
          </TabsTrigger>
        </TabsList>

        {/* Tab: Barbearia */}
        <TabsContent value="barbearia">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Informações da Barbearia</CardTitle>
              <CardDescription className="text-muted-foreground">
                Dados básicos que aparecem para seus clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="max-w-xl">
                <Field>
                  <FieldLabel htmlFor="nome">Nome da Barbearia</FieldLabel>
                  <Input
                    id="nome"
                    value={barbearia.nome}
                    onChange={(e) => setBarbearia({ ...barbearia, nome: e.target.value })}
                    className="bg-input border-border text-foreground"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="telefone">Telefone / WhatsApp</FieldLabel>
                  <Input
                    id="telefone"
                    value={barbearia.telefone}
                    onChange={(e) => setBarbearia({ ...barbearia, telefone: e.target.value })}
                    className="bg-input border-border text-foreground"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="endereco">Endereço</FieldLabel>
                  <Input
                    id="endereco"
                    value={barbearia.endereco}
                    onChange={(e) => setBarbearia({ ...barbearia, endereco: e.target.value })}
                    className="bg-input border-border text-foreground"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="cidade">Cidade</FieldLabel>
                    <Input
                      id="cidade"
                      value={barbearia.cidade}
                      onChange={(e) => setBarbearia({ ...barbearia, cidade: e.target.value })}
                      className="bg-input border-border text-foreground"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="estado">Estado</FieldLabel>
                    <Input
                      id="estado"
                      value={barbearia.estado}
                      onChange={(e) => setBarbearia({ ...barbearia, estado: e.target.value })}
                      className="bg-input border-border text-foreground"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="cep">CEP</FieldLabel>
                  <Input
                    id="cep"
                    value={barbearia.cep}
                    onChange={(e) => setBarbearia({ ...barbearia, cep: e.target.value })}
                    className="bg-input border-border text-foreground max-w-[200px]"
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Horários */}
        <TabsContent value="horarios">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Horário de Funcionamento</CardTitle>
              <CardDescription className="text-muted-foreground">
                Defina os dias e horários de atendimento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {diasSemana.map((dia) => {
                  const horario = horarios[dia.key as keyof typeof horarios]
                  return (
                    <div 
                      key={dia.key}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                        horario.ativo ? 'border-border bg-secondary/30' : 'border-border/50 bg-secondary/10'
                      }`}
                    >
                      <Switch
                        checked={horario.ativo}
                        onCheckedChange={() => toggleDia(dia.key)}
                      />
                      <span className={`w-32 font-medium ${horario.ativo ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {dia.label}
                      </span>
                      {horario.ativo ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={horario.abertura}
                            onChange={(e) => setHorarios(prev => ({
                              ...prev,
                              [dia.key]: { ...prev[dia.key as keyof typeof prev], abertura: e.target.value }
                            }))}
                            className="w-32 bg-input border-border text-foreground"
                          />
                          <span className="text-muted-foreground">até</span>
                          <Input
                            type="time"
                            value={horario.fechamento}
                            onChange={(e) => setHorarios(prev => ({
                              ...prev,
                              [dia.key]: { ...prev[dia.key as keyof typeof prev], fechamento: e.target.value }
                            }))}
                            className="w-32 bg-input border-border text-foreground"
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Fechado</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Serviços */}
        <TabsContent value="servicos">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-foreground">Serviços</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Gerencie os serviços oferecidos
                </CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Serviço
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Adicionar Serviço</DialogTitle>
                  </DialogHeader>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Nome do Serviço</FieldLabel>
                      <Input className="bg-input border-border text-foreground" placeholder="Ex: Corte Navalhado" />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel>Duração (min)</FieldLabel>
                        <Input type="number" className="bg-input border-border text-foreground" placeholder="30" />
                      </Field>
                      <Field>
                        <FieldLabel>Preço (R$)</FieldLabel>
                        <Input type="number" className="bg-input border-border text-foreground" placeholder="35" />
                      </Field>
                    </div>
                    <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                      Adicionar Serviço
                    </Button>
                  </FieldGroup>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {listaServicos.map((servico) => (
                  <div 
                    key={servico.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                      servico.ativo ? 'border-border bg-secondary/30' : 'border-border/50 bg-secondary/10'
                    }`}
                  >
                    <Switch
                      checked={servico.ativo}
                      onCheckedChange={() => toggleServico(servico.id)}
                    />
                    <div className="flex-1">
                      <p className={`font-medium ${servico.ativo ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {servico.nome}
                      </p>
                      <p className="text-sm text-muted-foreground">{servico.duracao} minutos</p>
                    </div>
                    <span className="text-lg font-semibold text-primary">R${servico.preco}</span>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Equipe */}
        <TabsContent value="equipe">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-foreground">Equipe</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Gerencie os profissionais da barbearia
                </CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Profissional
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Adicionar Profissional</DialogTitle>
                  </DialogHeader>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Nome Completo</FieldLabel>
                      <Input className="bg-input border-border text-foreground" placeholder="Nome do profissional" />
                    </Field>
                    <Field>
                      <FieldLabel>Email</FieldLabel>
                      <Input type="email" className="bg-input border-border text-foreground" placeholder="email@exemplo.com" />
                    </Field>
                    <Field>
                      <FieldLabel>Comissão (%)</FieldLabel>
                      <Input type="number" className="bg-input border-border text-foreground" placeholder="50" />
                    </Field>
                    <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                      Adicionar Profissional
                    </Button>
                  </FieldGroup>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {listaProfissionais.map((prof) => (
                  <div 
                    key={prof.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                      prof.ativo ? 'border-border bg-secondary/30' : 'border-border/50 bg-secondary/10'
                    }`}
                  >
                    <Switch
                      checked={prof.ativo}
                      onCheckedChange={() => toggleProfissional(prof.id)}
                    />
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="font-semibold text-primary">
                        {prof.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${prof.ativo ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {prof.nome}
                      </p>
                      <p className="text-sm text-muted-foreground">{prof.email}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-primary">{prof.comissao}%</p>
                      <p className="text-xs text-muted-foreground">comissão</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
