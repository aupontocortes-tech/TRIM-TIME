"use client"

import { useState } from "react"
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
  ChevronRight
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Tipo do cliente
type Cliente = {
  id: number
  nome: string
  telefone: string
  email: string
  totalVisitas: number
  ultimaVisita: string
  totalGasto: number
  servicoFavorito: string
}

// Mock data inicial
const clientesIniciais: Cliente[] = [
  { 
    id: 1, 
    nome: "Carlos Silva", 
    telefone: "(11) 99999-1111", 
    email: "carlos@email.com",
    totalVisitas: 24,
    ultimaVisita: "2024-03-15",
    totalGasto: 1320,
    servicoFavorito: "Corte + Barba"
  },
  { 
    id: 2, 
    nome: "João Pedro", 
    telefone: "(11) 99999-2222", 
    email: "joao@email.com",
    totalVisitas: 18,
    ultimaVisita: "2024-03-14",
    totalGasto: 810,
    servicoFavorito: "Corte Degradê"
  },
  { 
    id: 3, 
    nome: "Rafael Santos", 
    telefone: "(11) 99999-3333", 
    email: "rafael@email.com",
    totalVisitas: 12,
    ultimaVisita: "2024-03-12",
    totalGasto: 540,
    servicoFavorito: "Barba"
  },
  { 
    id: 4, 
    nome: "Lucas Oliveira", 
    telefone: "(11) 99999-4444", 
    email: "lucas@email.com",
    totalVisitas: 8,
    ultimaVisita: "2024-03-10",
    totalGasto: 360,
    servicoFavorito: "Corte Social"
  },
  { 
    id: 5, 
    nome: "Pedro Henrique", 
    telefone: "(11) 99999-5555", 
    email: "pedro@email.com",
    totalVisitas: 15,
    ultimaVisita: "2024-03-08",
    totalGasto: 1200,
    servicoFavorito: "Pigmentação"
  },
  { 
    id: 6, 
    nome: "Mateus Costa", 
    telefone: "(11) 99999-6666", 
    email: "mateus@email.com",
    totalVisitas: 6,
    ultimaVisita: "2024-03-05",
    totalGasto: 270,
    servicoFavorito: "Corte + Barba"
  },
]

const historicoCliente = [
  { data: "15/03/2024", servico: "Corte + Barba", profissional: "Carlos", valor: 55 },
  { data: "01/03/2024", servico: "Corte + Barba", profissional: "Carlos", valor: 55 },
  { data: "15/02/2024", servico: "Barba", profissional: "João", valor: 25 },
  { data: "01/02/2024", servico: "Corte + Barba", profissional: "Carlos", valor: 55 },
]

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciais)
  const [busca, setBusca] = useState("")
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [openNovoCliente, setOpenNovoCliente] = useState(false)
  const [formNovoCliente, setFormNovoCliente] = useState({ nome: "", telefone: "", email: "" })

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (numbers.length <= 2) return value
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const handleSalvarNovoCliente = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNovoCliente.nome.trim()) return
    const novoId = Math.max(0, ...clientes.map(c => c.id)) + 1
    setClientes([
      ...clientes,
      {
        id: novoId,
        nome: formNovoCliente.nome.trim(),
        telefone: formNovoCliente.telefone || "—",
        email: formNovoCliente.email.trim() || "—",
        totalVisitas: 0,
        ultimaVisita: "",
        totalGasto: 0,
        servicoFavorito: "—"
      }
    ])
    setFormNovoCliente({ nome: "", telefone: "", email: "" })
    setOpenNovoCliente(false)
  }

  const clientesFiltrados = clientes.filter(c => 
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone.includes(busca)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Gerencie seus clientes e histórico</p>
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
                  onChange={(e) => setFormNovoCliente(prev => ({ ...prev, nome: e.target.value }))}
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
                  onChange={(e) => setFormNovoCliente(prev => ({ ...prev, telefone: formatPhone(e.target.value) }))}
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
                  onChange={(e) => setFormNovoCliente(prev => ({ ...prev, email: e.target.value }))}
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
                <Button type="submit" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                  Salvar Cliente
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
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
            <p className="text-2xl font-bold text-green-500">+12</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border sm:col-span-1 col-span-2">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Ticket Médio</p>
            <p className="text-2xl font-bold text-primary">R$52</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Clients List */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {clientesFiltrados.length === 0 ? (
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
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-semibold text-primary">
                      {cliente.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{cliente.nome}</p>
                    <p className="text-sm text-muted-foreground">{cliente.telefone}</p>
                  </div>

                  <div className="hidden sm:block text-center px-4">
                    <p className="text-lg font-semibold text-foreground">{cliente.totalVisitas}</p>
                    <p className="text-xs text-muted-foreground">visitas</p>
                  </div>

                  <div className="hidden md:block text-center px-4">
                    <p className="text-lg font-semibold text-primary">R${cliente.totalGasto}</p>
                    <p className="text-xs text-muted-foreground">total gasto</p>
                  </div>

                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Client Detail Dialog */}
      <Dialog open={!!clienteSelecionado} onOpenChange={() => setClienteSelecionado(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Detalhes do Cliente</DialogTitle>
          </DialogHeader>

          {clienteSelecionado && (
            <div className="space-y-6">
              {/* Client Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-2xl font-semibold text-primary">
                    {clienteSelecionado.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="text-xl font-semibold text-foreground">{clienteSelecionado.nome}</p>
                  <a href={`tel:${clienteSelecionado.telefone}`} className="text-primary flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {clienteSelecionado.telefone}
                  </a>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{clienteSelecionado.totalVisitas}</p>
                  <p className="text-xs text-muted-foreground">Visitas</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">R${clienteSelecionado.totalGasto}</p>
                  <p className="text-xs text-muted-foreground">Total Gasto</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-2xl font-bold text-foreground flex items-center justify-center">
                    <Star className="w-5 h-5 text-primary fill-primary mr-1" />
                    VIP
                  </p>
                  <p className="text-xs text-muted-foreground">Status</p>
                </div>
              </div>

              {/* Info */}
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
                      ? new Date(clienteSelecionado.ultimaVisita).toLocaleDateString('pt-BR') 
                      : "Nunca"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-foreground font-medium">{clienteSelecionado.email}</span>
                </div>
              </div>

              {/* History */}
              <div>
                <h4 className="font-medium text-foreground mb-3">Histórico de Visitas</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {historicoCliente.map((visita, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-foreground">{visita.servico}</p>
                        <p className="text-xs text-muted-foreground">{visita.data} - {visita.profissional}</p>
                      </div>
                      <span className="text-sm font-semibold text-primary">R${visita.valor}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 border-border text-foreground hover:bg-secondary"
                  onClick={() => setClienteSelecionado(null)}
                >
                  Fechar
                </Button>
                <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                  Agendar para Cliente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
