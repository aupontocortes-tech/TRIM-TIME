"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Shield, LogOut, LayoutDashboard } from "lucide-react"

type NavTheme = {
  bg: string
  bgMuted: string
  border: string
  borderMuted: string
}

/** Fundos sólidos + texto branco (sem transparência). */
const NAV_THEMES: NavTheme[] = [
  { bg: "#B8860B", bgMuted: "#8B6914", border: "#D4A017", borderMuted: "#6B520F" },
  { bg: "#1F8A7A", bgMuted: "#166658", border: "#2AA896", borderMuted: "#0F4D44" },
  { bg: "#7B52B8", bgMuted: "#5A3D88", border: "#9466D4", borderMuted: "#452F66" },
  { bg: "#2B6CB0", bgMuted: "#1E4F85", border: "#3B82C4", borderMuted: "#163A60" },
  { bg: "#2F855A", bgMuted: "#226644", border: "#38A169", borderMuted: "#184A32" },
  { bg: "#C05640", bgMuted: "#943F2E", border: "#E07055", borderMuted: "#6E3022" },
  { bg: "#4A6FA5", bgMuted: "#355278", border: "#5C85B8", borderMuted: "#283D58" },
  { bg: "#A16207", bgMuted: "#7A4D05", border: "#CA8A04", borderMuted: "#5C3A04" },
]

function navButtonStyle(theme: NavTheme, active: boolean): CSSProperties {
  return {
    color: "#FFFFFF",
    backgroundColor: active ? theme.bg : theme.bgMuted,
    borderColor: active ? theme.border : theme.borderMuted,
    fontWeight: active ? 700 : 600,
  }
}

export default function PlataformaConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [hoveredNav, setHoveredNav] = useState<string | null>(null)

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
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <Shield className="w-10 h-10 animate-pulse text-[#E8C872]" />
          <p className="text-zinc-400 text-sm tracking-wide" style={{ fontFamily: "var(--font-inter)" }}>
            Verificando acesso…
          </p>
        </div>
      </div>
    )
  }

  const navItems = [
    { href: "/plataforma", label: "Dashboard", match: pathname === "/plataforma" },
    { href: "/plataforma/barbershops", label: "Barbearias", match: pathname.startsWith("/plataforma/barbershops") },
    { href: "/plataforma/ranking", label: "Ranking", match: pathname.startsWith("/plataforma/ranking") },
    { href: "/plataforma/suporte", label: "Suporte", match: pathname.startsWith("/plataforma/suporte") },
    { href: "/plataforma/financeiro", label: "Financeiro", match: pathname.startsWith("/plataforma/financeiro") },
    { href: "/plataforma/trim-player", label: "Trim Player", match: pathname.startsWith("/plataforma/trim-player") },
    { href: "/plataforma/tutoriais", label: "Tutoriais", match: pathname.startsWith("/plataforma/tutoriais") },
    { href: "/plataforma/configuracoes", label: "Configurações", match: pathname.startsWith("/plataforma/configuracoes") },
  ]

  const navMobile = [
    { href: "/plataforma", label: "Início", match: pathname === "/plataforma" },
    { href: "/plataforma/barbershops", label: "Lojas", match: pathname.startsWith("/plataforma/barbershops") },
    { href: "/plataforma/ranking", label: "Ranking", match: pathname.startsWith("/plataforma/ranking") },
    { href: "/plataforma/suporte", label: "Chat", match: pathname.startsWith("/plataforma/suporte") },
    { href: "/plataforma/financeiro", label: "Financeiro", match: pathname.startsWith("/plataforma/financeiro") },
    { href: "/plataforma/trim-player", label: "Player", match: pathname.startsWith("/plataforma/trim-player") },
    { href: "/plataforma/tutoriais", label: "Vídeos", match: pathname.startsWith("/plataforma/tutoriais") },
    { href: "/plataforma/configuracoes", label: "Config", match: pathname.startsWith("/plataforma/configuracoes") },
  ]

  const navLabelClass =
    "text-[14px] font-bold tracking-wide whitespace-nowrap leading-tight antialiased"

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 bg-[#060606]/98 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="flex h-[3.75rem] items-center justify-between gap-6">
            <Link href="/plataforma" className="flex items-center gap-3 shrink-0 group min-w-0">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#C9A962]/14 to-[#C9A962]/3 border border-[#C9A962]/22 group-hover:border-[#C9A962]/38 transition-colors">
                <Shield className="w-4 h-4 text-[#C9A962]" />
              </span>
              <span
                className="hidden md:block text-[17px] font-semibold tracking-[0.02em] text-[#E8DFC8] truncate"
                style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
              >
                Plataforma Trim Time
              </span>
            </Link>

            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/painel"
                className={`${navLabelClass} hidden sm:inline-flex items-center px-3 py-2 rounded-lg border transition-all duration-200`}
                style={{
                  fontFamily: "var(--font-playfair), Georgia, serif",
                  color: "#6BBFB0",
                  borderColor: "rgba(107,191,176,0.28)",
                  backgroundColor: "rgba(107,191,176,0.08)",
                }}
              >
                App barbearia
              </Link>
              <button
                type="button"
                onClick={() => router.push("/plataforma/login")}
                className={`${navLabelClass} inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 hover:bg-white/[0.04] transition-all duration-200`}
                style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>

          <nav className="hidden lg:grid lg:grid-cols-4 xl:grid-cols-8 gap-2.5 w-full pb-4 pt-1">
            {navItems.map((item, i) => {
              const theme = NAV_THEMES[i % NAV_THEMES.length]!
              const active = item.match
              const hovered = hoveredNav === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => setHoveredNav(item.href)}
                  onMouseLeave={() => setHoveredNav(null)}
                  className={`${navLabelClass} flex items-center justify-center text-center px-3 py-2.5 rounded-lg border transition-all duration-200 min-h-[42px]`}
                  style={
                    active
                      ? navButtonStyle(theme, true)
                      : hovered
                        ? {
                            color: "#FFFFFF",
                            backgroundColor: theme.bg,
                            borderColor: theme.border,
                            fontWeight: 700,
                          }
                        : navButtonStyle(theme, false)
                  }
                >
                  <span style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="lg:hidden flex items-center gap-2.5 px-5 pb-3 overflow-x-auto border-t border-white/[0.06] pt-3 scrollbar-thin">
          <LayoutDashboard className="w-4 h-4 shrink-0 text-[#FFE08A] mr-0.5" />
          {navMobile.map((item, i) => {
            const theme = NAV_THEMES[i % NAV_THEMES.length]!
            const active = item.match
            return (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 px-4 py-2.5 rounded-lg border text-[13px] font-bold tracking-wide whitespace-nowrap transition-all antialiased"
                style={active ? navButtonStyle(theme, true) : navButtonStyle(theme, false)}
              >
                <span style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
