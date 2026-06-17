"use client"

import Link from "next/link"
import { ArrowLeft, Gauge } from "lucide-react"
import { InfrastructureUsagePanel } from "@/components/admin/infrastructure-usage-panel"

const GOLD = "#D4AF37"

export default function PlataformaUsoLimitesPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start gap-3">
        <Link
          href="/plataforma/configuracoes"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-[#D4AF37] transition-colors mt-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Configurações
        </Link>
      </div>

      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#D4AF37]/40"
          style={{ backgroundColor: `${GOLD}14` }}
        >
          <Gauge className="w-6 h-6" style={{ color: GOLD }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Uso e limites (FREE)</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Resend, Supabase e cadastros no mês — barras verde, amarelo e vermelho para saber quando
            contratar um plano pago.
          </p>
        </div>
      </div>

      <InfrastructureUsagePanel />
    </div>
  )
}
