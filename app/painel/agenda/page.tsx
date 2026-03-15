"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  Phone,
  Clock,
  User,
  Filter
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Mock data
const agendamentos = [
  { id: 1, hora: "09:00", cliente: "Carlos Silva", telefone: "(11) 99999-1111", servico: "Corte + Barba", duracao: 50, valor: 55, status: "confirmado", profissional: "Carlos" },
  { id: 2, hora: "10:00", cliente: "João Pedro", telefone: "(11) 99999-2222", servico: "Corte Degradê", duracao: 40, valor: 45, status: "confirmado", profissional: "João" },
  { id: 3, hora: "11:00", cliente: "Rafael Santos", telefone: "(11) 99999-3333", servico: "Barba", duracao: 20, valor: 25, status: "pendente", profissional: "Carlos" },
  { id: 4, hora: "11:30", cliente: "Lucas Oliveira", telefone: "(11) 99999-4444", servico: "Corte Social", duracao: 30, valor: 35, status: "confirmado", profissional: "Rafael" },
  { id: 5, hora: "14:00", cliente: "Pedro Henrique", telefone: "(11) 99999-5555", servico: "Pigmentação", duracao: 60, valor: 80, status: "confirmado", profissional: "Carlos" },
  { id: 6, hora: "15:00", cliente: "Mateus Costa", telefone: "(11) 99999-6666", servico: "Corte + Barba", duracao: 50, valor: 55, status: "pendente", profissional: "João" },
  { id: 7, hora: "16:00", cliente: "Bruno Lima", telefone: "(11) 99999-7777", servico: "Corte Degradê", duracao: 40, valor: 45, status: "confirmado", profissional: "Rafael" },
  { id: 8, hora: "17:00", cliente: "André Santos", telefone: "(11) 99999-8888", servico: "Barba", duracao: 20, valor: 25, status: "confirmado", profissional: "Carlos" },
]

const profissionais = ["Todos", "Carlos", "João", "Rafael"]

const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

export default function AgendaPage() {
  const [dataSelecionada, setDataSelecionada] = useState(new Date())
  const [filtroProf, setFiltroProf] = useState("Todos")
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<typeof agendamentos[0] | null>(null)

  const agendamentosFiltrados = filtroProf === "Todos" 
    ? agendamentos 
    : agendamentos.filter(a => a.profissional === filtroProf)

  const mudarDia = (dias: number) => {
    const novaData = new Date(dataSelecionada)
    novaData.setDate(novaData.getDate() + dias)
    setDataSelecionada(novaData)
  }

  const formatarData = (data: Date) => {
    const hoje = new Date()
    const amanha = new Date(hoje)
    amanha.setDate(amanha.getDate() + 1)

    if (data.toDateString() === hoje.toDateString()) {
      return "Hoje"
    } else if (data.toDateString() === amanha.toDateString()) {
      return "Amanhã"
    } else {
      return `${diasSemana[data.getDay()]}, ${data.getDate()}/${data.getMonth() + 1}`
    }
  }

  const totalFaturamento = agendamentosFiltrados.reduce((acc, a) => acc + a.valor, 0)
  const totalConfirmados = agendamentosFiltrados.filter(a => a.status === 'confirmado').length
  const totalPendentes = agendamentosFiltrados.filter(a => a.status === 'pendente').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground">Gerencie os agendamentos da sua barbearia</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
          + Novo Agendamento
        </Button>
      </div>

      {/* Date Navigation */}
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
                {dataSelecionada.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
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

      {/* Stats */}
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
            <p className="text-2xl font-bold text-primary">R${totalFaturamento}</p>
            <p className="text-xs text-muted-foreground">Previsto</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        {profissionais.map((prof) => (
          <Button
            key={prof}
            variant={filtroProf === prof ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroProf(prof)}
            className={filtroProf === prof 
              ? "bg-primary text-primary-foreground hover:bg-primary/90" 
              : "border-border text-foreground hover:bg-secondary"
            }
          >
            {prof}
          </Button>
        ))}
      </div>

      {/* Appointments List */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Agendamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {agendamentosFiltrados.length === 0 ? (
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
                    <span className="text-sm font-semibold text-primary">R${agendamento.valor}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      agendamento.status === 'confirmado' 
                        ? 'bg-green-500/10 text-green-500' 
                        : 'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {agendamento.status === 'confirmado' ? 'Confirmado' : 'Pendente'}
                    </span>
                  </div>

                  {agendamento.status === 'pendente' && (
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-green-500 hover:bg-green-500/10"
                        onClick={(e) => { e.stopPropagation() }}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation() }}
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

      {/* Appointment Detail Dialog */}
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
                  <a href={`tel:${agendamentoSelecionado.telefone}`} className="text-sm text-primary flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {agendamentoSelecionado.telefone}
                  </a>
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
                <span className="text-xl font-bold text-primary">R${agendamentoSelecionado.valor}</span>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 border-border text-foreground hover:bg-secondary"
                  onClick={() => setAgendamentoSelecionado(null)}
                >
                  Fechar
                </Button>
                {agendamentoSelecionado.status === 'pendente' && (
                  <>
                    <Button className="flex-1 bg-green-500 text-white hover:bg-green-600">
                      <Check className="w-4 h-4 mr-2" />
                      Confirmar
                    </Button>
                  </>
                )}
                {agendamentoSelecionado.status === 'confirmado' && (
                  <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                    Finalizar Atendimento
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
