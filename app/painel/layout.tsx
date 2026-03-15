"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useBarbershop } from "@/hooks/use-barbershop"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  DollarSign,
  Settings,
  Menu,
  X,
  LogOut,
  Bell,
  ChevronDown,
  Shield
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const menuItems = [
  { href: "/painel", label: "Dashboard", icon: LayoutDashboard },
  { href: "/painel/agenda", label: "Agenda", icon: Calendar },
  { href: "/painel/clientes", label: "Clientes", icon: Users },
  { href: "/painel/financeiro", label: "Financeiro", icon: DollarSign },
  { href: "/painel/configuracoes", label: "Configurações", icon: Settings },
]

export default function PainelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { barbershop } = useBarbershop()
  const [impersonating, setImpersonating] = useState(false)

  useEffect(() => {
    fetch("/api/admin/impersonate")
      .then((r) => r.json())
      .then((data) => setImpersonating(data.impersonating === true))
      .catch(() => setImpersonating(false))
  }, [])

  const handleVoltarAdmin = () => {
    fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).then(() => router.push("/admin"))
  }

  const handleSair = () => {
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b border-border">
            <Link href="/painel" className="flex items-center focus:outline-none focus:ring-2 focus:ring-primary rounded-lg transition-opacity hover:opacity-90">
              <img src="/icon.svg" alt="Trim Time" className="w-10 h-10 rounded-lg" />
            </Link>
            <button 
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-4 border-b border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Sua barbearia</p>
            <p className="font-semibold text-foreground truncate">{barbershop?.name ?? "Trim Time"}</p>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/painel" && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
            {barbershop?.role === "admin" && (
              <Link
                href="/admin"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-amber-600 hover:bg-amber-500/10"
              >
                <Shield className="w-5 h-5" />
                <span className="font-medium">Painel Admin</span>
              </Link>
            )}
          </nav>

          <div className="p-4 border-t border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-secondary transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {(barbershop?.name ?? "U").charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-foreground truncate">{barbershop?.name ?? "Usuário"}</p>
                    <p className="text-xs text-muted-foreground">{barbershop?.role === "admin" ? "Super Admin" : "Barbearia"}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/painel/configuracoes" className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive cursor-pointer" onClick={handleSair}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        {impersonating && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Você está acessando como esta barbearia (impersonação).
            </p>
            <Button variant="outline" size="sm" onClick={handleVoltarAdmin} className="border-amber-600 text-amber-700 hover:bg-amber-500/20">
              Voltar ao Painel Admin
            </Button>
          </div>
        )}
        <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between h-full px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <button 
                className="lg:hidden text-muted-foreground hover:text-foreground"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-lg font-semibold text-foreground hidden sm:block">
                {menuItems.find(item => 
                  pathname === item.href || (item.href !== "/painel" && pathname.startsWith(item.href))
                )?.label || "Dashboard"}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
              </Button>
              <Link href={barbershop?.slug ? `/b/${barbershop.slug}` : "/b/trim-time"} target="_blank">
                <Button variant="outline" size="sm" className="hidden sm:flex border-border text-foreground hover:bg-secondary">
                  Ver página pública
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
