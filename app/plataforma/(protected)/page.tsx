"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Store,
  Users,
  Calendar,
  DollarSign,
  CreditCard,
  Crown,
  Sparkles,
} from "lucide-react"
import Link from "next/link"

const GOLD = "#D4AF37"

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
}: {
  label: string
  value: string | number
  icon: typeof Store
}) {
  return (
    <Card className="bg-zinc-950 border-[#D4AF37]/35 text-white shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">{label}</p>
            <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{value}</p>
          </div>
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border border-[#D4AF37]/30"
            style={{ backgroundColor: `${GOLD}14` }}
          >
            <Icon className="w-5 h-5" style={{ color: GOLD }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Controle da plataforma Trim Time — métricas e ações rápidas
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Barbearias"
          value={loading ? "—" : (stats?.totalBarbershops ?? 0)}
          icon={Store}
        />
        <StatCard
          label="Clientes (cadastro)"
          value={loading ? "—" : (stats?.totalClients ?? 0)}
          icon={Users}
        />
        <StatCard
          label="Agendamentos"
          value={loading ? "—" : (stats?.totalAppointments ?? 0)}
          icon={Calendar}
        />
        <StatCard
          label="Receita (ledger)"
          value={loading ? "—" : fmtMoney(stats?.totalRevenue ?? 0)}
          icon={DollarSign}
        />
        <StatCard
          label="Plano básico (free)"
          value={loading ? "—" : (stats?.planFree ?? 0)}
          icon={CreditCard}
        />
        <StatCard
          label="Pro + Premium"
          value={loading ? "—" : (stats?.planPremiumTier ?? 0)}
          icon={Crown}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 text-sm text-zinc-400">
        <Card className="bg-zinc-950 border-[#D4AF37]/35">
          <CardContent className="p-4 flex items-center gap-3">
            <Sparkles className="w-5 h-5 shrink-0" style={{ color: GOLD }} />
            <div>
              <p className="text-white font-medium">Assinaturas ativas / trial</p>
              <p className="tabular-nums text-lg text-[#D4AF37]">
                {loading ? "—" : stats?.totalAssinaturasAtivas ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-[#D4AF37]/35">
          <CardContent className="p-4">
            <p className="text-white font-medium mb-2">Detalhe dos planos</p>
            <p>
              Basic: {loading ? "—" : stats?.planBasic ?? 0} · Pro:{" "}
              {loading ? "—" : stats?.planPro ?? 0} · Premium:{" "}
              {loading ? "—" : stats?.planPremium ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-950 border-[#D4AF37]/35">
        <CardContent className="p-6">
          <h2 className="font-semibold text-white mb-2">Gestão</h2>
          <p className="text-zinc-400 text-sm mb-4">
            Barbearias, planos, suspensão, conta de teste e impersonação.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/plataforma/barbershops"
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-black bg-[#D4AF37] hover:bg-[#c9a227]"
            >
              Barbearias
            </Link>
            <Link
              href="/plataforma/ranking"
              className="inline-flex items-center justify-center rounded-md border border-[#D4AF37]/50 px-4 py-2 text-sm text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              Ranking
            </Link>
            <Link
              href="/plataforma/suporte"
              className="inline-flex items-center justify-center rounded-md border border-[#D4AF37]/50 px-4 py-2 text-sm text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              Suporte / chat
            </Link>
            <Link
              href="/plataforma/trim-player"
              className="inline-flex items-center justify-center rounded-md border border-[#D4AF37]/50 px-4 py-2 text-sm text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              Trim Player
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
