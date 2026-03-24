"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { ArrowLeft, Shield } from "lucide-react"

const GOLD = "#D4AF37"

/** Login separado do app das barbearias — apenas SUPER_ADMIN_EMAIL. */
export default function PlataformaLoginPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/platform-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Não foi possível entrar.")
        setIsLoading(false)
        return
      }
      const next =
        typeof data.redirect === "string" && data.redirect.startsWith("/")
          ? data.redirect
          : "/plataforma"
      window.location.assign(next)
    } catch {
      setError("Erro ao entrar. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: GOLD }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ backgroundColor: GOLD }}
        />
      </div>

      <div className="w-full max-w-md relative">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-[#D4AF37] transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Login das barbearias
        </Link>

        <Card className="bg-zinc-950 border-[#D4AF37]/35 shadow-none">
          <CardHeader className="text-center pb-2">
            <div className="mb-4 flex justify-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#D4AF37]/40"
                style={{ backgroundColor: `${GOLD}18` }}
              >
                <Shield className="w-8 h-8" style={{ color: GOLD }} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Plataforma Trim Time</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Acesso exclusivo da equipe — métricas globais, barbearias e suporte
            </p>
          </CardHeader>

          <CardContent className="pt-4 pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? (
                <div className="p-3 rounded-lg border border-red-500/40 bg-red-950/40 text-red-200 text-sm">
                  {error}
                </div>
              ) : null}

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="platform-email" className="text-zinc-200">
                    E-mail da plataforma
                  </FieldLabel>
                  <Input
                    id="platform-email"
                    type="email"
                    autoComplete="username"
                    placeholder="configurado em SUPER_ADMIN_EMAIL"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </Field>
              </FieldGroup>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full font-semibold text-black hover:opacity-95"
                style={{ backgroundColor: GOLD }}
              >
                {isLoading ? "Entrando…" : "Entrar na plataforma"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
