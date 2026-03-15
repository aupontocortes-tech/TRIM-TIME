"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Store, Users, CreditCard } from "lucide-react"
import Link from "next/link"

type Stats = {
  totalBarbershops: number
  totalUsuarios: number
  totalAssinaturasAtivas: number
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema Trim Time</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total de barbearias</p>
                <p className="text-3xl font-bold text-foreground">
                  {loading ? "—" : (stats?.totalBarbershops ?? 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Store className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total de usuários</p>
                <p className="text-3xl font-bold text-foreground">
                  {loading ? "—" : (stats?.totalUsuarios ?? 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Assinaturas ativas</p>
                <p className="text-3xl font-bold text-foreground">
                  {loading ? "—" : (stats?.totalAssinaturasAtivas ?? 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <h2 className="font-semibold text-foreground mb-2">Gerenciamento</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Liste todas as barbearias, edite dados, altere plano, suspenda ou ative contas e entre como usuário para acessar a conta da barbearia.
          </p>
          <Link
            href="/admin/barbershops"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Ver lista de barbearias
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

