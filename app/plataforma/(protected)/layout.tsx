"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Shield, LogOut, LayoutDashboard } from "lucide-react"

const GOLD = "#D4AF37"

export default function PlataformaConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/barbershops")
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          role?: string
          error?: string
        }
        if (cancelled) return
        if (res.status === 401 || res.status === 404 || (data?.error && !data?.role)) {
          router.replace("/plataforma/login")
          return
        }
        if (data?.role !== "super_admin") {
          router.replace("/painel")
          return
        }
        setAllowed(true)
      })
      .catch(() => {
        if (!cancelled) router.replace("/plataforma/login")
      })
    return () => {
      cancelled = true
    }
  }, [router])

  if (allowed !== true) {
    return (
      <div
        className="min-h-screen bg-black flex items-center justify-center text-white"
        style={{ ["--gold" as string]: GOLD }}
      >
        <div className="flex flex-col items-center gap-4">
          <Shield className="w-10 h-10 animate-pulse" style={{ color: GOLD }} />
          <p className="text-zinc-400">Verificando acesso…</p>
        </div>
      </div>
    )
  }

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
            <Link href="/plataforma" className="flex items-center gap-2 font-semibold text-white">
              <Shield className="w-6 h-6" style={{ color: GOLD }} />
              <span className="hidden sm:inline">Plataforma Trim Time</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-5">
              {link("/plataforma", "Dashboard", pathname === "/plataforma")}
              {link(
                "/plataforma/barbershops",
                "Barbearias",
                pathname.startsWith("/plataforma/barbershops")
              )}
              {link("/plataforma/ranking", "Ranking", pathname.startsWith("/plataforma/ranking"))}
              {link("/plataforma/suporte", "Suporte", pathname.startsWith("/plataforma/suporte"))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/painel"
              className="text-sm text-zinc-400 hover:text-[#D4AF37] transition-colors"
            >
              App barbearia (painel)
            </Link>
            <button
              type="button"
              onClick={() => router.push("/plataforma/login")}
              className="text-sm text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
        <div className="sm:hidden flex gap-3 px-4 pb-2 overflow-x-auto border-t border-[#D4AF37]/20">
          <LayoutDashboard className="w-4 h-4 shrink-0 text-[#D4AF37]" />
          {link("/plataforma", "Início", pathname === "/plataforma")}
          {link("/plataforma/barbershops", "Lojas", pathname.startsWith("/plataforma/barbershops"))}
          {link("/plataforma/ranking", "Ranking", pathname.startsWith("/plataforma/ranking"))}
          {link("/plataforma/suporte", "Chat", pathname.startsWith("/plataforma/suporte"))}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
