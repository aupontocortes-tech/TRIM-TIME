"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useBarbershop } from "@/hooks/use-barbershop"
import { useUnits } from "@/hooks/use-units"
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
  Shield,
  MessageCircle,
  Building2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BrandLogo } from "@/components/brand-logo"

/** Role para exibição do menu: super_admin e admin_barbershop veem tudo; user (barbeiro) só agenda e clientes. */
type MenuRole = "super_admin" | "admin_barbershop" | "user"
const menuItems: { href: string; label: string; icon: typeof LayoutDashboard; roles?: MenuRole[] }[] = [
  { href: "/painel", label: "Dashboard", icon: LayoutDashboard },
  { href: "/painel/agenda", label: "Agenda", icon: Calendar },
  { href: "/painel/clientes", label: "Clientes", icon: Users },
  { href: "/painel/financeiro", label: "Financeiro", icon: DollarSign, roles: ["super_admin", "admin_barbershop"] },
  {
    href: "/painel/minha-rede",
    label: "Minha rede",
    icon: Building2,
    roles: ["super_admin", "admin_barbershop"],
  },
  { href: "/painel/configuracoes", label: "Configurações", icon: Settings, roles: ["super_admin", "admin_barbershop"] },
  { href: "/painel/suporte", label: "Suporte", icon: MessageCircle },
]

export default function PainelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { barbershop, loading: barbershopLoading } = useBarbershop()
  const { units, selectedUnitId, changeUnit, loading: unitsLoading } = useUnits()
  const [impersonating, setImpersonating] = useState(false)
  /** Role para menu: hoje sempre da barbearia; quando houver login de barbeiro, usar barber.role (user = só agenda/clientes). */
  const menuRole: MenuRole = (barbershop?.role ?? "admin_barbershop") as MenuRole
  const visibleMenuItems = menuItems.filter((item) => !item.roles || item.roles.includes(menuRole))

  useEffect(() => {
    fetch("/api/admin/impersonate")
      .then((r) => r.json())
      .then((data) => setImpersonating(data.impersonating === true))
      .catch(() => setImpersonating(false))
  }, [])

  useEffect(() => {
    if (barbershopLoading) return
    if (!barbershop) {
      router.replace("/login")
    }
  }, [barbershopLoading, barbershop, router])

  const handleVoltarAdmin = () => {
    fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).then(() => router.push("/plataforma"))
  }

  const handleSair = () => {
    router.push("/login")
  }

  const selectedUnitLabel =
    selectedUnitId && units.length > 0
      ? units.find((u) => u.id === selectedUnitId)?.name ?? "Unidade"
      : "Todas unidades"

  if (barbershopLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Carregando painel…
      </div>
    )
  }

  if (!barbershop) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Redirecionando para o login…
      </div>
    )
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
          <div className="flex items-center justify-between gap-2 min-h-[11rem] px-3 py-4 border-b border-border">
            {/* flex-1 só no wrapper: o Link fica só no tamanho do quadrado → anel de foco dourado alinha com o ícone */}
            <div className="flex min-w-0 flex-1 justify-center">
              <Link
                href="/painel"
                className="inline-flex shrink-0 rounded-xl outline-none transition-opacity hover:opacity-95 focus:ring-2 focus:ring-primary focus:ring-inset focus:ring-offset-0 focus:ring-offset-transparent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                aria-label="Ir para o dashboard"
              >
                {/* Quadro quadrado: mesmo tom da sidebar (bg-card), só borda neutra — sem brilho dourado no ícone */}
                <div className="flex aspect-square h-28 w-28 max-w-full shrink-0 items-center justify-center rounded-xl border border-border/80 bg-card p-2 shadow-none">
                  <BrandLogo size="panel" withBorder={false} priority />
                </div>
              </Link>
            </div>
            <button 
              className="lg:hidden shrink-0 text-muted-foreground hover:text-foreground p-1"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-4 border-b border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Sua barbearia</p>
            <p className="font-semibold text-foreground truncate">{barbershop?.name ?? "Trim Time"}</p>
            <div className="mt-3">
              <p className="text-[11px] text-muted-foreground mb-1">Unidade ativa</p>
              <select
                className="w-full h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground"
                value={selectedUnitId ?? "__all__"}
                disabled={unitsLoading}
                onChange={async (e) => {
                  const next = e.target.value === "__all__" ? null : e.target.value
                  await changeUnit(next)
                  window.location.reload()
                }}
              >
                <option value="__all__">Todas unidades</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {visibleMenuItems.map((item) => {
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
            {barbershop?.role === "super_admin" && (
              <Link
                href="/plataforma"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-primary hover:bg-primary/10"
              >
                <Shield className="w-5 h-5" />
                <span className="font-medium">Plataforma Trim Time</span>
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
                    <p className="text-xs text-muted-foreground">{barbershop?.role === "super_admin" ? "Super Admin" : "Barbearia"}</p>
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
          <div className="bg-primary/15 border-b border-primary/30 px-4 py-2 flex items-center justify-between">
            <p className="text-sm text-primary">
              Você está acessando como esta barbearia (impersonação).
            </p>
            <Button variant="outline" size="sm" onClick={handleVoltarAdmin} className="border-primary text-primary hover:bg-primary/20">
              Voltar à plataforma
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
                {visibleMenuItems.find(item => 
                  pathname === item.href || (item.href !== "/painel" && pathname.startsWith(item.href))
                )?.label || "Dashboard"}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <label htmlFor="unit-select" className="text-xs text-muted-foreground">
                  Unidade
                </label>
                <select
                  id="unit-select"
                  className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground"
                  value={selectedUnitId ?? "__all__"}
                  disabled={unitsLoading}
                  onChange={async (e) => {
                    const next = e.target.value === "__all__" ? null : e.target.value
                    await changeUnit(next)
                  window.location.reload()
                  }}
                >
                  <option value="__all__">Todas unidades</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
              </Button>
              <span className="md:hidden text-xs text-muted-foreground">{selectedUnitLabel}</span>
              <Link href={barbershop?.slug ? `/b/${barbershop.slug}` : "/b/trim-time"} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="hidden sm:flex border-border text-foreground hover:bg-secondary">
                  Link para clientes
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
