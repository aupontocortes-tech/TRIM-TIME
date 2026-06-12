"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { ArrowLeft, Loader2 } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"

function RecuperarSenhaContent() {
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await fetch("/api/auth/forgot-password/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(typeof j.error === "string" ? j.error : "Erro ao enviar código")
        return
      }
      setMsg("Código enviado para seu e-mail. Verifique também o spam.")
      setStep("code")
    } catch {
      setErr("Erro de rede")
    } finally {
      setLoading(false)
    }
  }

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setErr("As senhas não coincidem.")
      return
    }
    if (password.length < 6) {
      setErr("A senha deve ter pelo menos 6 caracteres.")
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch("/api/auth/forgot-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(typeof j.error === "string" ? j.error : "Erro ao redefinir")
        return
      }
      setMsg("Senha atualizada! Redirecionando para o login…")
      setTimeout(() => {
        window.location.assign("/login")
      }, 1500)
    } catch {
      setErr("Erro de rede")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md relative">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </Link>

        <Card className="bg-card border-border">
          <CardHeader className="text-center pb-2">
            <div className="mb-4 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-border/80 bg-card p-2">
                <BrandLogo size="lg" withBorder={false} priority />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Redefinir senha</h1>
            <p className="text-muted-foreground text-sm">
              {step === "email"
                ? "Conta criada com Google ou esqueceu a senha? Defina uma nova."
                : "Digite o código recebido por e-mail e escolha a nova senha."}
            </p>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {err ? (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                {err}
              </div>
            ) : null}
            {msg ? (
              <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border rounded-lg p-3">
                {msg}
              </div>
            ) : null}

            {step === "email" ? (
              <form onSubmit={(e) => void sendCode(e)} className="space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">E-mail da barbearia</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="seu@email.com"
                    />
                  </Field>
                </FieldGroup>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Enviar código
                </Button>
              </form>
            ) : (
              <form onSubmit={(e) => void confirmReset(e)} className="space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="code">Código (e-mail)</FieldLabel>
                    <Input
                      id="code"
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      required
                      placeholder="000000"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">Nova senha</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirm">Confirmar senha</FieldLabel>
                    <Input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      minLength={6}
                    />
                  </Field>
                </FieldGroup>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salvar nova senha
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setStep("email")
                    setCode("")
                  }}
                >
                  Reenviar código
                </Button>
              </form>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Prefere entrar sem senha?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Use Entrar com Google
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function RecuperarSenhaPage() {
  return (
    <Suspense fallback={null}>
      <RecuperarSenhaContent />
    </Suspense>
  )
}
