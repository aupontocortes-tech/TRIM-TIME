"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff, ArrowLeft } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"

/** Dados salvos só neste aparelho (localStorage). Não use em computadores compartilhados. */
const SAVED_LOGIN_KEY = "trimtime_saved_login_v1"

type SavedLogin = { email: string; password: string }

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  })
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_LOGIN_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as SavedLogin
      if (parsed?.email && typeof parsed.password === "string") {
        setFormData({ email: parsed.email, password: parsed.password })
        setRememberDevice(true)
      }
    } catch {
      localStorage.removeItem(SAVED_LOGIN_KEY)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
        credentials: "include",
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string
          usePlatformLogin?: boolean
        }
        if (err.usePlatformLogin) {
          setError(
            err.error ||
              "Use o acesso Plataforma Trim Time (link abaixo) para este e-mail."
          )
        } else {
          setError(err.error || "Email ou senha inválidos")
        }
        setIsLoading(false)
        return
      }
      const data = (await res.json().catch(() => ({}))) as {
        redirect?: string
      }
      if (typeof window !== "undefined") {
        if (rememberDevice) {
          const payload: SavedLogin = {
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
          }
          localStorage.setItem(SAVED_LOGIN_KEY, JSON.stringify(payload))
        } else {
          localStorage.removeItem(SAVED_LOGIN_KEY)
        }
      }
      const next =
        typeof data.redirect === "string" && data.redirect.startsWith("/")
          ? data.redirect
          : "/dashboard-barbearia"
      if (typeof window !== "undefined") {
        window.location.assign(next)
        return
      }
      router.push(next)
    } catch {
      setError("Erro ao entrar. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Back button */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o início
        </Link>

        <Card className="bg-card border-border">
          <CardHeader className="text-center pb-2">
            <div className="mb-4 flex justify-center">
              {/* Quadro neutro alinhado ao tema — sem auréola dourada (BrandLogo withBorder) */}
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-card p-2 shadow-none">
                <BrandLogo size="xl" withBorder={false} priority />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Área do Barbeiro</h1>
            <p className="text-muted-foreground">Acesse sua barbearia no Trim Time</p>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                  />
                </Field>

                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="password">Senha</FieldLabel>
                    <Link 
                      href="/recuperar-senha" 
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueceu a senha?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
              </FieldGroup>

              <div className="flex justify-start pt-1">
                <Checkbox
                  checked={rememberDevice}
                  onCheckedChange={(v) => setRememberDevice(v === true)}
                  className="size-5 shrink-0 rounded-[4px] border-2 border-border"
                  aria-label="Salvar e-mail e senha neste aparelho"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isLoading}
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6 space-y-2">
              <span className="block">
                Ainda não tem conta?{" "}
                <Link href="/cadastro?tipo=barbearia" className="text-primary hover:underline font-medium">
                  Cadastre sua barbearia
                </Link>
              </span>
              <span className="block pt-1 border-t border-border/60 mt-3">
                Equipe Trim Time (métricas globais)?{" "}
                <Link
                  href="/plataforma/login"
                  className="text-primary hover:underline font-medium"
                >
                  Acesso plataforma
                </Link>
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
