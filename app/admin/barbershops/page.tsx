"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Store, Pencil, LogIn, Ban, CheckCircle } from "lucide-react"
import type { Barbershop, BarbershopRole } from "@/lib/db/types"
import type { SubscriptionPlan } from "@/lib/db/types"

type BarbershopWithSub = Barbershop & {
  subscription?: { plan: SubscriptionPlan; status: string } | null
}

const ROLE_LABELS: Record<BarbershopRole, string> = {
  super_admin: "Super Admin",
  admin_barbershop: "Dono da barbearia",
}

export default function AdminBarbershopsPage() {
  const [list, setList] = useState<BarbershopWithSub[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<BarbershopWithSub | null>(null)
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    plan: "basic" as SubscriptionPlan,
    role: "admin_barbershop" as BarbershopRole,
    suspended: false,
  })

  const load = () => {
    fetch("/api/admin/barbershops")
      .then((r) => (r.ok ? r.json() : []))
      .then(setList)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openEdit = (b: BarbershopWithSub) => {
    setEditing(b)
    setForm({
      name: b.name,
      email: b.email,
      phone: b.phone ?? "",
      plan: b.subscription?.plan ?? "basic",
      role: (b.role === "super_admin" ? "super_admin" : "admin_barbershop") as BarbershopRole,
      suspended: !!b.suspended_at,
    })
  }

  const saveEdit = async () => {
    if (!editing) return
    const res = await fetch(`/api/admin/barbershops/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        plan: form.plan,
        role: form.role,
        suspended: form.suspended,
      }),
    })
    if (res.ok) {
      setEditing(null)
      load()
    }
  }

  const impersonate = async (barbershopId: string) => {
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barbershop_id: barbershopId }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.redirect) window.location.href = data.redirect
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Barbearias</h1>
        <p className="text-muted-foreground">Lista de todas as barbearias cadastradas</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Gerenciamento</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : list.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma barbearia cadastrada.</p>
          ) : (
            <div className="space-y-3">
              {list.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border border-border bg-secondary/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Store className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{b.name}</p>
                      <p className="text-sm text-muted-foreground">{b.email}</p>
                      <p className="text-xs text-muted-foreground">
                        /b/{b.slug} • {ROLE_LABELS[b.role as BarbershopRole] ?? b.role} • Plano: {b.subscription?.plan ?? "—"} • {b.suspended_at ? "Suspensa" : "Ativa"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(b)}>
                      <Pencil className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => impersonate(b.id)}
                    >
                      <LogIn className="w-4 h-4 mr-1" />
                      Entrar como usuário
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar barbearia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground">Nome</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 bg-input border-border"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 bg-input border-border"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Telefone</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 bg-input border-border"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Tipo de conta</label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as BarbershopRole }))}
              >
                <SelectTrigger className="mt-1 bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_barbershop">{ROLE_LABELS.admin_barbershop}</SelectItem>
                  <SelectItem value="super_admin">{ROLE_LABELS.super_admin}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Super Admin acessa o painel /admin e tudo grátis.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Plano</label>
              <Select
                value={form.plan}
                onValueChange={(v) => setForm((f) => ({ ...f, plan: v as SubscriptionPlan }))}
              >
                <SelectTrigger className="mt-1 bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Básico</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="suspended"
                checked={form.suspended}
                onChange={(e) => setForm((f) => ({ ...f, suspended: e.target.checked }))}
                className="rounded border-border"
              />
              <label htmlFor="suspended" className="text-sm font-medium text-foreground">
                Conta suspensa
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
