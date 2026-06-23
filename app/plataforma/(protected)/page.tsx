"use client"

import { useState, useEffect, type CSSProperties } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Store,
  Users,
  Calendar,
  DollarSign,
  CreditCard,
  Crown,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

type CardTheme = {
  accent: string
  label: string
  border: string
  bg: string
  iconBg: string
}

const CARD_THEMES: CardTheme[] = [
  { accent: "#FFE08A", label: "#E8C872", border: "rgba(255,224,138,0.35)", bg: "rgba(255,224,138,0.08)", iconBg: "rgba(255,224,138,0.15)" },
  { accent: "#9EEDE0", label: "#7DD3C0", border: "rgba(158,237,224,0.35)", bg: "rgba(158,237,224,0.08)", iconBg: "rgba(158,237,224,0.15)" },
  { accent: "#D8BCFF", label: "#C4A8F5", border: "rgba(216,188,255,0.35)", bg: "rgba(216,188,255,0.08)", iconBg: "rgba(216,188,255,0.15)" },
  { accent: "#A8D8FF", label: "#8EC5F0", border: "rgba(168,216,255,0.35)", bg: "rgba(168,216,255,0.08)", iconBg: "rgba(168,216,255,0.15)" },
  { accent: "#A8EEC4", label: "#86D4A8", border: "rgba(168,238,196,0.35)", bg: "rgba(168,238,196,0.08)", iconBg: "rgba(168,238,196,0.15)" },
  { accent: "#FFBCAC", label: "#F0A898", border: "rgba(255,188,172,0.35)", bg: "rgba(255,188,172,0.08)", iconBg: "rgba(255,188,172,0.15)" },
]

const QUICK_LINK_THEMES = CARD_THEMES.slice(0, 4)

type Stats = {
  totalBarbershops: number
  totalClients: number
  totalAppointments: number
  totalRevenue: number
  planFree: number
  planPremiumTier: number
  planBasic: number
  planPro: number
  planPremium: number
  totalAssinaturasAtivas: number
}

function StatCard({
  label,
  value,
  icon: Icon,
  theme,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  theme: CardTheme
}) {
  return (
    <Card
      className="relative overflow-hidden rounded-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.35)] text-white"
      style={{
        borderColor: theme.border,
        background: `linear-gradient(145deg, rgba(12,12,12,0.98) 0%, rgba(6,6,6,0.99) 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${theme.accent}88, transparent)`,
        }}
      />
      <div
        className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-30"
        style={{ backgroundColor: theme.accent }}
      />
      <CardContent className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.12em] mb-2"
              style={{ color: theme.label, fontFamily: "var(--font-inter)" }}
            >
              {label}
            </p>
            <p
              className="text-2xl sm:text-[1.75rem] font-bold text-white tabular-nums tracking-tight"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              {value}
            </p>
          </div>
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.iconBg,
            }}
          >
            <Icon className="w-5 h-5" style={{ color: theme.accent }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function quickLinkStyle(theme: CardTheme): CSSProperties {
  return {
    color: theme.accent,
    borderColor: theme.border,
    backgroundColor: theme.bg,
    fontFamily: "var(--font-playfair), Georgia, serif",
  }
}

export default function PlataformaDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

  const statItems = [
    { label: "Barbearias", value: loading ? "—" : (stats?.totalBarbershops ?? 0), icon: Store },
    { label: "Clientes (cadastro)", value: loading ? "—" : (stats?.totalClients ?? 0), icon: Users },
    { label: "Agendamentos", value: loading ? "—" : (stats?.totalAppointments ?? 0), icon: Calendar },
    { label: "Receita (ledger)", value: loading ? "—" : fmtMoney(stats?.totalRevenue ?? 0), icon: DollarSign },
    { label: "Plano básico (free)", value: loading ? "—" : (stats?.planFree ?? 0), icon: CreditCard },
    { label: "Pro + Premium", value: loading ? "—" : (stats?.planPremiumTier ?? 0), icon: Crown },
  ]

  const quickLinks = [
    { href: "/plataforma/barbershops", label: "Barbearias" },
    { href: "/plataforma/ranking", label: "Ranking" },
    { href: "/plataforma/suporte", label: "Suporte / chat" },
    { href: "/plataforma/trim-player", label: "Trim Player" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-2xl sm:text-3xl font-bold text-[#F5EDD6] tracking-tight"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          Dashboard
        </h1>
        <p className="text-zinc-400 text-sm mt-2 tracking-wide">
          Controle da plataforma Trim Time — métricas e ações rápidas
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {statItems.map((item, i) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            icon={item.icon}
            theme={CARD_THEMES[i]!}
          />
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
        <Card
          className="relative overflow-hidden rounded-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
          style={{
            borderColor: CARD_THEMES[0]!.border,
            background: "linear-gradient(145deg, rgba(12,12,12,0.98) 0%, rgba(6,6,6,0.99) 100%)",
          }}
        >
          <CardContent className="p-5 sm:p-6 flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center border shrink-0"
              style={{
                borderColor: CARD_THEMES[0]!.border,
                backgroundColor: CARD_THEMES[0]!.iconBg,
              }}
            >
              <Sparkles className="w-5 h-5" style={{ color: CARD_THEMES[0]!.accent }} />
            </div>
            <div>
              <p
                className="text-sm font-semibold text-zinc-300"
                style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
              >
                Assinaturas ativas / trial
              </p>
              <p
                className="tabular-nums text-2xl font-bold mt-1"
                style={{ color: CARD_THEMES[0]!.accent, fontFamily: "var(--font-playfair), Georgia, serif" }}
              >
                {loading ? "—" : stats?.totalAssinaturasAtivas ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="relative overflow-hidden rounded-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
          style={{
            borderColor: CARD_THEMES[5]!.border,
            background: "linear-gradient(145deg, rgba(12,12,12,0.98) 0%, rgba(6,6,6,0.99) 100%)",
          }}
        >
          <CardContent className="p-5 sm:p-6">
            <p
              className="text-sm font-semibold text-zinc-300 mb-3"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              Detalhe dos planos
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <span>
                <span className="font-bold" style={{ color: CARD_THEMES[4]!.accent }}>Basic</span>
                <span className="text-zinc-400 ml-1.5">{loading ? "—" : stats?.planBasic ?? 0}</span>
              </span>
              <span className="text-zinc-700">·</span>
              <span>
                <span className="font-bold" style={{ color: CARD_THEMES[2]!.accent }}>Pro</span>
                <span className="text-zinc-400 ml-1.5">{loading ? "—" : stats?.planPro ?? 0}</span>
              </span>
              <span className="text-zinc-700">·</span>
              <span>
                <span className="font-bold" style={{ color: CARD_THEMES[5]!.accent }}>Premium</span>
                <span className="text-zinc-400 ml-1.5">{loading ? "—" : stats?.planPremium ?? 0}</span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card
        className="relative overflow-hidden rounded-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background: "linear-gradient(145deg, rgba(12,12,12,0.98) 0%, rgba(6,6,6,0.99) 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <CardContent className="p-6 sm:p-8">
          <h2
            className="font-bold text-[#F5EDD6] text-lg mb-1"
            style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
          >
            Gestão
          </h2>
          <p className="text-zinc-400 text-sm mb-5">
            Barbearias, planos, suspensão, conta de teste e impersonação.
          </p>
          <div className="flex flex-wrap gap-3">
            {quickLinks.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-[14px] font-bold tracking-[0.02em] border transition-all duration-200 hover:brightness-110 hover:scale-[1.02]"
                style={quickLinkStyle(QUICK_LINK_THEMES[i]!)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
