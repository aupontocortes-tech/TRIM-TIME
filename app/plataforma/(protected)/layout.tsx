"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Shield, LogOut, LayoutDashboard } from "lucide-react"

type NavTheme = {
  text: string
  textMuted: string
  bg: string
  bgHover: string
  border: string
  borderHover: string
}

const NAV_THEMES: NavTheme[] = [
  { text: "#C9A962", textMuted: "#8A7344", bg: "rgba(201,169,98,0.14)", bgHover: "rgba(201,169,98,0.06)", border: "rgba(201,169,98,0.32)", borderHover: "rgba(201,169,98,0.18)" },
  { text: "#6BBFB0", textMuted: "#4A857A", bg: "rgba(107,191,176,0.14)", bgHover: "rgba(107,191,176,0.06)", border: "rgba(107,191,176,0.32)", borderHover: "rgba(107,191,176,0.18)" },
  { text: "#A88BD4", textMuted: "#735896", bg: "rgba(168,139,212,0.14)", bgHover: "rgba(168,139,212,0.06)", border: "rgba(168,139,212,0.32)", borderHover: "rgba(168,139,212,0.18)" },
  { text: "#6A9FC4", textMuted: "#4A7088", bg: "rgba(106,159,196,0.14)", bgHover: "rgba(106,159,196,0.06)", border: "rgba(106,159,196,0.32)", borderHover: "rgba(106,159,196,0.18)" },
  { text: "#6BAF88", textMuted: "#4A7858", bg: "rgba(107,175,136,0.14)", bgHover: "rgba(107,175,136,0.06)", border: "rgba(107,175,136,0.32)", borderHover: "rgba(107,175,136,0.18)" },
  { text: "#C48878", textMuted: "#885F54", bg: "rgba(196,136,120,0.14)", bgHover: "rgba(196,136,120,0.06)", border: "rgba(196,136,120,0.32)", borderHover: "rgba(196,136,120,0.18)" },
  { text: "#8A9BB0", textMuted: "#5E6D7D", bg: "rgba(138,155,176,0.14)", bgHover: "rgba(138,155,176,0.06)", border: "rgba(138,155,176,0.32)", borderHover: "rgba(138,155,176,0.18)" },
  { text: "#B8A078", textMuted: "#7D6E52", bg: "rgba(184,160,120,0.14)", bgHover: "rgba(184,160,120,0.06)", border: "rgba(184,160,120,0.32)", borderHover: "rgba(184,160,120,0.18)" },
]

function navButtonStyle(theme: NavTheme, active: boolean): CSSProperties {
  return active
    ? {
        color: theme.text,
        backgroundColor: theme.bg,
        borderColor: theme.border,
        textShadow: "0 1px 8px rgba(0,0,0,0.35)",
      }
    : {
        color: theme.textMuted,
        backgroundColor: theme.bgHover,
        borderColor: theme.borderHover,
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
    "text-[13px] font-semibold tracking-[0.04em] whitespace-nowrap leading-none"

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

          <nav className="hidden lg:flex flex-wrap items-center gap-2 pb-3.5 pt-0.5">
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
                  className={`${navLabelClass} px-3.5 py-2 rounded-lg border transition-all duration-200`}
                  style={
                    active
                      ? navButtonStyle(theme, true)
                      : hovered
                        ? {
                            color: theme.text,
                            backgroundColor: theme.bg,
                            borderColor: theme.border,
                          }
                        : navButtonStyle(theme, false)
                  }
                >
                  <span style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="lg:hidden flex items-center gap-2 px-5 pb-3 overflow-x-auto border-t border-white/[0.04] pt-2.5 scrollbar-thin">
          <LayoutDashboard className="w-4 h-4 shrink-0 text-[#C9A962] mr-0.5 opacity-80" />
          {navMobile.map((item, i) => {
            const theme = NAV_THEMES[i % NAV_THEMES.length]!
            const active = item.match
            return (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 px-3 py-2 rounded-lg border text-[12px] font-semibold tracking-[0.04em] whitespace-nowrap transition-all"
                style={active ? navButtonStyle(theme, true) : navButtonStyle(theme, false)}
              >
                <span style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
