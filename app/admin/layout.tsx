"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Shield, LogOut, LayoutDashboard } from "lucide-react"

const GOLD = "#D4AF37"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    fetch("/api/barbershops")
      .then((r) => r.json())
      .then((data) => {
        if (data?.role === "super_admin") setAllowed(true)
        else setAllowed(false)
      })
      .catch(() => setAllowed(false))
  }, [])

  useEffect(() => {
    if (allowed === false) router.replace("/")
  }, [allowed, router])

  if (allowed === null) {
    return (
      <div
        className="min-h-screen bg-black flex items-center justify-center text-white"
        style={{ ["--gold" as string]: GOLD }}
      >
        <div className="flex flex-col items-center gap-4">
          <Shield className="w-10 h-10 animate-pulse" style={{ color: GOLD }} />
          <p className="text-zinc-400">Verificando acesso...</p>
        </div>
      </div>
    )
  }

  if (!allowed) return null

  const link = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors ${
        active ? "text-white" : "text-zinc-400 hover:text-[#D4AF37]"
      }`}
      style={active ? { color: GOLD } : undefined}
    >
      {label}
    </Link>
  )

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-[#D4AF37]/35 bg-black/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2 font-semibold text-white">
              <Shield className="w-6 h-6" style={{ color: GOLD }} />
              <span className="hidden sm:inline">Trim Time Admin</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-5">
              {link("/admin", "Dashboard", pathname === "/admin")}
              {link(
                "/admin/barbershops",
                "Barbearias",
                pathname.startsWith("/admin/barbershops")
              )}
              {link("/admin/ranking", "Ranking", pathname.startsWith("/admin/ranking"))}
              {link("/admin/suporte", "Suporte", pathname.startsWith("/admin/suporte"))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/painel"
              className="text-sm text-zinc-400 hover:text-[#D4AF37] transition-colors"
            >
              Painel barbearia
            </Link>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="text-sm text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
        <div className="sm:hidden flex gap-3 px-4 pb-2 overflow-x-auto border-t border-[#D4AF37]/20">
          <LayoutDashboard className="w-4 h-4 shrink-0 text-[#D4AF37]" />
          {link("/admin", "Início", pathname === "/admin")}
          {link("/admin/barbershops", "Lojas", pathname.startsWith("/admin/barbershops"))}
          {link("/admin/ranking", "Ranking", pathname.startsWith("/admin/ranking"))}
          {link("/admin/suporte", "Chat", pathname.startsWith("/admin/suporte"))}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
