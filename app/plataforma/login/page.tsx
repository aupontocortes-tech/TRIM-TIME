"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { ArrowLeft, Eye, EyeOff, Shield } from "lucide-react"

const GOLD = "#D4AF37"

const platformInputClass =
  "h-11 rounded-lg border border-zinc-700/90 bg-zinc-900/95 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_2px_8px_rgba(0,0,0,0.35)] placeholder:text-zinc-500 focus-visible:border-[#D4AF37]/55 focus-visible:ring-2 focus-visible:ring-[#D4AF37]/25 transition-colors [&:-webkit-autofill]:[-webkit-text-fill-color:rgb(255_255_255)] [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_rgb(24_24_27)]"

/** Login separado do app das barbearias — apenas SUPER_ADMIN_EMAIL. */
export default function PlataformaLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
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
        body: JSON.stringify({ email: email.trim(), password }),
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
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 text-white antialiased">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,55,0.14), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(212,175,55,0.08), transparent 50%)",
          }}
        />
        <div
          className="absolute top-[12%] left-[18%] w-[28rem] h-[28rem] rounded-full blur-[100px] opacity-[0.22]"
          style={{ backgroundColor: GOLD }}
        />
        <div
          className="absolute bottom-[8%] right-[12%] w-[24rem] h-[24rem] rounded-full blur-[120px] opacity-[0.12]"
          style={{ backgroundColor: GOLD }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-[#D4AF37] transition-colors mb-8 text-sm tracking-wide"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          Login das barbearias
        </Link>

        <Card className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-b from-zinc-950/98 via-zinc-950 to-[#0a0a0a] shadow-[0_0_0_1px_rgba(212,175,55,0.08),0_0_48px_rgba(212,175,55,0.1),0_28px_56px_rgba(0,0,0,0.65)] backdrop-blur-md">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent"
            aria-hidden
          />
          <CardHeader className="text-center pb-2 pt-8">
            <div className="mb-5 flex justify-center">
              <div
                className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-2xl border border-[#D4AF37]/45 shadow-[0_0_28px_rgba(212,175,55,0.22),inset_0_1px_0_rgba(255,255,255,0.08)]"
                style={{ background: `linear-gradient(145deg, ${GOLD}22 0%, ${GOLD}08 45%, rgba(9,9,11,0.9) 100%)` }}
              >
                <Shield
                  className="w-9 h-9 drop-shadow-[0_0_12px_rgba(212,175,55,0.45)]"
                  style={{ color: GOLD }}
                  strokeWidth={1.75}
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Plataforma Trim Time</h1>
            <p className="text-zinc-400/95 text-sm mt-2 max-w-[18rem] mx-auto leading-relaxed">
              Acesso exclusivo da equipe — métricas globais, barbearias e suporte
            </p>
          </CardHeader>

          <CardContent className="pt-2 pb-9 px-6 sm:px-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error ? (
                <div className="p-3 rounded-lg border border-red-500/40 bg-red-950/50 text-red-200 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  {error}
                </div>
              ) : null}

              <FieldGroup className="gap-5">
                <Field>
                  <FieldLabel htmlFor="platform-email" className="text-zinc-300 text-sm font-medium">
                    E-mail da plataforma
                  </FieldLabel>
                  <Input
                    id="platform-email"
                    type="email"
                    autoComplete="username"
                    placeholder="seu e-mail de super admin"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={platformInputClass}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="platform-password" className="text-zinc-300 text-sm font-medium">
                    Senha
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      id="platform-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className={`${platformInputClass} pr-11`}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#D4AF37] transition-colors"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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
