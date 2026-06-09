"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Loader2, RefreshCw, RotateCcw, Search, Wallet } from "lucide-react"

type PaymentRow = {
  id: string
  barbershop_id: string
  barbershop_name: string
  barbershop_email: string
  external_id: string | null
  amount: number
  status: string
  plan: string | null
  created_at: string
  refundable: boolean
  metadata: unknown
}

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Pago",
  RECEIVED: "Recebido",
  RECEIVED_IN_CASH: "Recebido",
  PENDING: "Pendente",
  REFUNDED: "Estornado",
  OVERDUE: "Vencido",
}

function formatBrl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
}

function FinanceiroContent() {
  const searchParams = useSearchParams()
  const filterBarbershopId = searchParams.get("barbershop_id")?.trim() || ""

  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [err, setErr] = useState("")
  const [msg, setMsg] = useState("")
  const [refundTarget, setRefundTarget] = useState<PaymentRow | null>(null)
  const [refundReason, setRefundReason] = useState("")
  const [refundBusy, setRefundBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr("")
    try {
      const params = new URLSearchParams()
      if (filterBarbershopId) params.set("barbershop_id", filterBarbershopId)
      if (q.trim()) params.set("q", q.trim())
      const r = await fetch(`/api/admin/payments?${params.toString()}`)
      const j = await r.json()
      if (!r.ok) {
        setErr(typeof j.error === "string" ? j.error : "Erro ao carregar")
        setRows([])
        return
      }
      setRows(Array.isArray(j) ? j : [])
    } catch {
      setErr("Erro de rede")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [filterBarbershopId, q])

  useEffect(() => {
    void load()
  }, [load])

  const openRefund = (row: PaymentRow) => {
    setRefundTarget(row)
    setRefundReason(`Estorno solicitado — ${row.barbershop_name}`)
    setMsg("")
    setErr("")
  }

  const confirmRefund = async () => {
    if (!refundTarget) return
    if (
      !confirm(
        `Estornar ${formatBrl(refundTarget.amount)} para ${refundTarget.barbershop_name}? O valor volta pelo Asaas no cartão.`
      )
    ) {
      return
    }
    setRefundBusy(true)
    setErr("")
    try {
      const r = await fetch(`/api/admin/payments/${refundTarget.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: refundReason.trim() || undefined }),
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(typeof j.error === "string" ? j.error : "Erro ao estornar")
        return
      }
      setMsg(`Estorno solicitado para ${refundTarget.barbershop_name}. Status Asaas: ${j.refundStatus ?? "em processamento"}.`)
      setRefundTarget(null)
      void load()
    } catch {
      setErr("Erro de rede ao estornar")
    } finally {
      setRefundBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-7 h-7 text-[#D4AF37]" />
            Financeiro
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Cobranças de assinatura Trim Time — estorne pelo app (via API Asaas).
          </p>
          {filterBarbershopId ? (
            <p className="text-xs text-[#D4AF37] mt-2">
              Filtrando barbearia{" "}
              <Link href="/plataforma/financeiro" className="underline hover:text-white">
                (ver todas)
              </Link>
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-[#D4AF37]/40 text-zinc-200 hover:bg-zinc-900"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card className="bg-zinc-950 border-[#D4AF37]/35">
        <CardHeader>
          <CardTitle className="text-white text-lg">Cobranças</CardTitle>
          <CardDescription className="text-zinc-400">
            Busque por nome, e-mail ou slug da barbearia. Estorno total — parcial pelo painel Asaas se necessário.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar barbearia…"
                className="pl-9 bg-zinc-900 border-zinc-700 text-white"
                onKeyDown={(e) => e.key === "Enter" && void load()}
              />
            </div>
            <Button
              type="button"
              className="bg-[#D4AF37] text-black hover:bg-[#c9a227]"
              onClick={() => void load()}
            >
              Buscar
            </Button>
          </div>

          {err ? (
            <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">{err}</div>
          ) : null}
          {msg ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-3 text-sm text-emerald-200">
              {msg}
            </div>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-zinc-500 text-sm py-8 text-center">Nenhuma cobrança encontrada.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-zinc-400">
                    <th className="p-3 font-medium">Barbearia</th>
                    <th className="p-3 font-medium">Plano</th>
                    <th className="p-3 font-medium">Valor</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-800/80 hover:bg-zinc-900/50">
                      <td className="p-3">
                        <p className="font-medium text-white">{row.barbershop_name}</p>
                        <p className="text-xs text-zinc-500">{row.barbershop_email}</p>
                      </td>
                      <td className="p-3 text-zinc-300 capitalize">{row.plan ?? "—"}</td>
                      <td className="p-3 text-white font-medium">{formatBrl(row.amount)}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.status === "REFUNDED"
                              ? "bg-zinc-800 text-zinc-400"
                              : row.refundable
                                ? "bg-emerald-950 text-emerald-400"
                                : "bg-amber-950/60 text-amber-300"
                          }`}
                        >
                          {STATUS_LABELS[row.status] ?? row.status}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-400 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-zinc-400 hover:text-[#D4AF37]"
                            asChild
                          >
                            <Link href={`/plataforma/suporte/${row.barbershop_id}`}>Suporte</Link>
                          </Button>
                          {row.refundable ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                              onClick={() => openRefund(row)}
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" />
                              Estornar
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!refundTarget} onOpenChange={(open) => !open && setRefundTarget(null)}>
        <DialogContent className="bg-zinc-950 border-[#D4AF37]/35 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Estornar cobrança</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {refundTarget
                ? `${formatBrl(refundTarget.amount)} — ${refundTarget.barbershop_name}. O valor será devolvido pelo Asaas.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="refund-reason" className="text-zinc-300">
              Motivo (registro interno)
            </Label>
            <Input
              id="refund-reason"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              className="text-zinc-400"
              onClick={() => setRefundTarget(null)}
              disabled={refundBusy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#D4AF37] text-black hover:bg-[#c9a227]"
              disabled={refundBusy}
              onClick={() => void confirmRefund()}
            >
              {refundBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar estorno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PlataformaFinanceiroPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-zinc-500" />
        </div>
      }
    >
      <FinanceiroContent />
    </Suspense>
  )
}
