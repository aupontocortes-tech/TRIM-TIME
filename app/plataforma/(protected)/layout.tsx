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
  { text: "#FFE08A", textMuted: "#E8C872", bg: "rgba(255,224,138,0.2)", bgHover: "rgba(255,224,138,0.1)", border: "rgba(255,224,138,0.45)", borderHover: "rgba(255,224,138,0.28)" },
  { text: "#9EEDE0", textMuted: "#7DD3C0", bg: "rgba(158,237,224,0.2)", bgHover: "rgba(158,237,224,0.1)", border: "rgba(158,237,224,0.45)", borderHover: "rgba(158,237,224,0.28)" },
  { text: "#D8BCFF", textMuted: "#C4A8F5", bg: "rgba(216,188,255,0.2)", bgHover: "rgba(216,188,255,0.1)", border: "rgba(216,188,255,0.45)", borderHover: "rgba(216,188,255,0.28)" },
  { text: "#A8D8FF", textMuted: "#8EC5F0", bg: "rgba(168,216,255,0.2)", bgHover: "rgba(168,216,255,0.1)", border: "rgba(168,216,255,0.45)", borderHover: "rgba(168,216,255,0.28)" },
  { text: "#A8EEC4", textMuted: "#86D4A8", bg: "rgba(168,238,196,0.2)", bgHover: "rgba(168,238,196,0.1)", border: "rgba(168,238,196,0.45)", borderHover: "rgba(168,238,196,0.28)" },
  { text: "#FFBCAC", textMuted: "#F0A898", bg: "rgba(255,188,172,0.2)", bgHover: "rgba(255,188,172,0.1)", border: "rgba(255,188,172,0.45)", borderHover: "rgba(255,188,172,0.28)" },
  { text: "#D4E4F8", textMuted: "#B8C8DC", bg: "rgba(212,228,248,0.2)", bgHover: "rgba(212,228,248,0.1)", border: "rgba(212,228,248,0.45)", borderHover: "rgba(212,228,248,0.28)" },
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
    { href: "/plataforma/configuracoes", label: "Configurações", match: pathname.startsWith("/plataforma/configuracoes") },
  ]

  const navMobile = [
    { href: "/plataforma", label: "Início", match: pathname === "/plataforma" },
    { href: "/plataforma/barbershops", label: "Lojas", match: pathname.startsWith("/plataforma/barbershops") },
    { href: "/plataforma/ranking", label: "Ranking", match: pathname.startsWith("/plataforma/ranking") },
    { href: "/plataforma/suporte", label: "Chat", match: pathname.startsWith("/plataforma/suporte") },
    { href: "/plataforma/financeiro", label: "Financeiro", match: pathname.startsWith("/plataforma/financeiro") },
    { href: "/plataforma/trim-player", label: "Player", match: pathname.startsWith("/plataforma/trim-player") },
    { href: "/plataforma/configuracoes", label: "Config", match: pathname.startsWith("/plataforma/configuracoes") },
  ]

  const navLabelClass =
    "text-[14px] font-bold tracking-[0.03em] whitespace-nowrap leading-none"

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 bg-[#080808]/98 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="flex h-[4.5rem] items-center justify-between gap-4">
            <Link href="/plataforma" className="flex items-center gap-3 shrink-0 group min-w-0">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8C872]/18 to-[#E8C872]/4 border border-[#E8C872]/28 group-hover:border-[#E8C872]/45 transition-colors">
                <Shield className="w-5 h-5 text-[#E8C872]" />
              </span>
              <span
                className="hidden md:block text-[18px] font-semibold tracking-[0.02em] text-[#F5EDD6] truncate"
                style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
              >
                Plataforma Trim Time
              </span>
            </Link>

            <nav className="hidden xl:flex items-center gap-1 shrink min-w-0">
              {navItems.map((item, i) => {
                const theme = NAV_THEMES[i]!
                const active = item.match
                const hovered = hoveredNav === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={() => setHoveredNav(item.href)}
                    onMouseLeave={() => setHoveredNav(null)}
                    className={`${navLabelClass} px-3.5 py-2.5 rounded-lg border transition-all duration-200`}
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

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/painel"
                className={`${navLabelClass} hidden sm:inline-flex items-center px-3.5 py-2.5 rounded-lg border transition-all duration-200`}
                style={{
                  fontFamily: "var(--font-playfair), Georgia, serif",
                  color: "#9EEDE0",
                  borderColor: "rgba(158,237,224,0.4)",
                  backgroundColor: "rgba(158,237,224,0.12)",
                }}
              >
                App barbearia
              </Link>
              <button
                type="button"
                onClick={() => router.push("/plataforma/login")}
                className={`${navLabelClass} inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-500 hover:bg-white/[0.05] transition-all duration-200`}
                style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>

        <div className="xl:hidden flex items-center gap-1.5 px-5 pb-3 overflow-x-auto border-t border-white/[0.04] pt-2.5">
          <LayoutDashboard className="w-4 h-4 shrink-0 text-[#E8C872] mr-0.5" />
          {navMobile.map((item, i) => {
            const theme = NAV_THEMES[i]!
            const active = item.match
            return (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 px-3 py-2 rounded-lg border text-[12px] font-bold tracking-[0.03em] whitespace-nowrap transition-all"
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
