"use client"

import Link from "next/link"
import { useBarbershop } from "@/hooks/use-barbershop"
import { useUnits } from "@/hooks/use-units"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, MapPin, Settings } from "lucide-react"

/** Visão do dono: unidades da própria barbearia (multiunidade no Premium). */
export default function MinhaRedePage() {
  const { barbershop, loading: bsLoading } = useBarbershop()
  const { units, loading: unitsLoading } = useUnits()
  const loading = bsLoading || unitsLoading

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Minha rede</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Supervisione a operação da sua marca: unidades, agenda e clientes por local. Use o seletor
          &quot;Unidade ativa&quot; na barra lateral para alternar o contexto do painel.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {barbershop?.name ?? "Sua barbearia"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : units.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma unidade cadastrada além da matriz. Com o plano Premium você pode criar filiais e
              gerenciá-las aqui e em Configurações.
            </p>
          ) : (
            <ul className="space-y-3">
              {units.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card/50 p-4"
                >
                  <div>
                    <p className="font-medium text-foreground">{u.name}</p>
                    {(u.city || u.address) && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {[u.address, u.city, u.state].filter(Boolean).join(" · ") || "—"}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild variant="default">
              <Link href="/painel/configuracoes">
                <Settings className="w-4 h-4 mr-2" />
                Unidades em Configurações
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/painel">Ir ao dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
