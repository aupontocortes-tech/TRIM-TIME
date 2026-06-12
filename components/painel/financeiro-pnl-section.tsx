"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Trash2 } from "lucide-react"

export type PnlData = {
  from: string
  to: string
  revenue: number
  expenses_total: number
  commissions_total: number
  owner_profit: number
  commission_enabled: boolean
  expenses_by_category: { category: string; label: string; amount: number }[]
  expenses: {
    id: string
    category: string
    category_label: string
    amount: number
    note: string | null
    name?: string
    vendor: string | null
    occurred_at: string
    unit_name: string | null
  }[]
  categories?: Record<string, string>
}

type Props = {
  from: string
  to: string
  isNetworkView: boolean
  onChanged: () => void
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  )
}

export function FinanceiroPnlSection({ from, to, isNetworkView, onChanged }: Props) {
  const [pnl, setPnl] = useState<PnlData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [category, setCategory] = useState("produtos")
  const [expenseName, setExpenseName] = useState("")
  const [amount, setAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const qs = new URLSearchParams({ from, to })
      if (isNetworkView) qs.set("scope", "network")
      const r = await fetch(`/api/financial/expenses?${qs}`, { credentials: "include" })
      const j = await r.json()
      if (!r.ok) {
        setErr(typeof j.error === "string" ? j.error : "Erro ao carregar")
        setPnl(null)
        return
      }
      setPnl(j as PnlData)
    } catch {
      setErr("Erro de rede")
      setPnl(null)
    } finally {
      setLoading(false)
    }
  }, [from, to, isNetworkView])

  useEffect(() => {
    void load()
  }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const r = await fetch("/api/financial/expenses", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          name: expenseName.trim(),
          amount: Number(amount.replace(",", ".")),
          occurred_at: expenseDate || undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(typeof j.error === "string" ? j.error : "Erro ao salvar")
        return
      }
      setAmount("")
      setExpenseName("")
      setExpenseDate("")
      void load()
      onChanged()
    } catch {
      setErr("Erro de rede")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta despesa?")) return
    setDeletingId(id)
    setErr(null)
    try {
      const r = await fetch(`/api/financial/expenses/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErr(typeof j.error === "string" ? j.error : "Erro ao excluir")
        return
      }
      void load()
      onChanged()
    } catch {
      setErr("Erro de rede")
    } finally {
      setDeletingId(null)
    }
  }

  const categories = pnl?.categories ?? {
    produtos: "Compra de produtos",
    energia: "Energia elétrica",
    agua: "Água",
    aluguel: "Aluguel",
    internet: "Internet / telefone",
    salarios: "Salários / encargos",
    marketing: "Marketing",
    manutencao: "Manutenção",
    impostos: "Impostos / taxas",
    outros: "Outros",
  }

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Despesas" value={loading ? "—" : `R$ ${brl(pnl?.expenses_total ?? 0)}`} />
        <Stat
          label="Comissões"
          value={
            loading ? "—" : pnl?.commission_enabled ? `R$ ${brl(pnl.commissions_total)}` : "—"
          }
        />
        <Stat
          label="Lucro do dono"
          value={loading ? "—" : `R$ ${brl(pnl?.owner_profit ?? 0)}`}
          highlight
        />
      </div>

      {err ? (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 rounded-lg p-3">
          {err}
        </div>
      ) : null}

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nova despesa</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleAdd(e)} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Nome</Label>
              <Input
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                placeholder="Ex.: Conta de luz"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categories).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={saving || !expenseName.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Adicionar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Despesas do período</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
          ) : !pnl?.expenses.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma despesa registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="py-2 pr-3 font-medium">Data</th>
                    <th className="py-2 pr-3 font-medium">Nome</th>
                    <th className="py-2 pr-3 font-medium text-right">Valor</th>
                    <th className="py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {pnl.expenses.map((ex) => (
                    <tr key={ex.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {new Date(`${ex.occurred_at}T12:00:00`).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="font-medium text-foreground">
                          {ex.name ?? ex.note ?? ex.category_label}
                        </span>
                        <span className="text-muted-foreground text-xs ml-2">{ex.category_label}</span>
                      </td>
                      <td className="py-2 pr-3 text-right font-medium text-red-500">
                        R$ {brl(ex.amount)}
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={deletingId === ex.id}
                          onClick={() => void handleDelete(ex.id)}
                        >
                          {deletingId === ex.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
