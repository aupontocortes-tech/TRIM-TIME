"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Loader2, Plus, Trash2, TrendingDown, TrendingUp, Wallet, Receipt } from "lucide-react"

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

export function FinanceiroPnlSection({ from, to, isNetworkView, onChanged }: Props) {
  const [pnl, setPnl] = useState<PnlData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [category, setCategory] = useState("produtos")
  const [expenseName, setExpenseName] = useState("")
  const [amount, setAmount] = useState("")
  const [vendor, setVendor] = useState("")
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
          vendor: vendor.trim() || undefined,
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
      setVendor("")
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
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Faturamento
            </div>
            <p className="text-2xl font-bold text-foreground">
              {loading ? "—" : `R$ ${brl(pnl?.revenue ?? 0)}`}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Despesas da loja
            </div>
            <p className="text-2xl font-bold text-foreground">
              {loading ? "—" : `R$ ${brl(pnl?.expenses_total ?? 0)}`}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Wallet className="w-4 h-4 text-amber-500" />
              Comissões (barbeiros)
            </div>
            <p className="text-2xl font-bold text-foreground">
              {loading ? "—" : pnl?.commission_enabled ? `R$ ${brl(pnl.commissions_total)}` : "—"}
            </p>
            {!loading && !pnl?.commission_enabled ? (
              <p className="text-xs text-muted-foreground mt-1">Plano Pro/Premium</p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="bg-card border-primary/40 border-2">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Receipt className="w-4 h-4 text-primary" />
              Lucro do dono
            </div>
            <p
              className={`text-2xl font-bold ${
                (pnl?.owner_profit ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {loading ? "—" : `R$ ${brl(pnl?.owner_profit ?? 0)}`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Faturamento − despesas − comissões</p>
          </CardContent>
        </Card>
      </div>

      {err ? (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 rounded-lg p-3">
          {err}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Registrar despesa</CardTitle>
            <CardDescription>
              Produtos, energia, água, aluguel e outros custos da loja no período selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleAdd(e)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome da despesa</Label>
                <Input
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  placeholder="Ex.: Conta de luz março, Shampoo profissional"
                  required
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
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
                  <Label>Valor (R$)</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fornecedor (opcional)</Label>
                  <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Ex.: CEMIG, fornecedor" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving || !expenseName.trim()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Adicionar despesa
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Despesas por categoria</CardTitle>
            <CardDescription>No intervalo {from} até {to}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
            ) : !pnl?.expenses_by_category.length ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma despesa registrada neste período.
              </p>
            ) : (
              <ul className="space-y-2">
                {pnl.expenses_by_category.map((c) => (
                  <li
                    key={c.category}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="text-foreground">{c.label}</span>
                    <span className="font-semibold text-red-500">R$ {brl(c.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Histórico de despesas</CardTitle>
          <CardDescription>Todas as saídas registradas no período</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
          ) : !pnl?.expenses.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma despesa no histórico.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="py-2 pr-3 font-medium">Data</th>
                    <th className="py-2 pr-3 font-medium">Categoria</th>
                    <th className="py-2 pr-3 font-medium">Nome</th>
                    <th className="py-2 pr-3 font-medium">Fornecedor</th>
                    <th className="py-2 pr-3 font-medium text-right">Valor</th>
                    <th className="py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {pnl.expenses.map((ex) => (
                    <tr key={ex.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {new Date(`${ex.occurred_at}T12:00:00`).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2.5 pr-3">{ex.category_label}</td>
                      <td className="py-2.5 pr-3 font-medium text-foreground">
                        {ex.name ?? ex.note ?? ex.category_label}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {[ex.vendor, ex.unit_name].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium text-red-500">
                        R$ {brl(ex.amount)}
                      </td>
                      <td className="py-2.5">
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
