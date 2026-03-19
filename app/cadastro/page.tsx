"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Eye, EyeOff, ArrowLeft, Check } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"

function CadastroPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planoSelecionado = searchParams.get("plano") || "premium"
  const tipo = searchParams.get("tipo") || "barbearia" // barbearia ou cliente

  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    password: "",
    confirmPassword: "",
    nomeBarbearia: "",
    endereco: "",
    cidade: "",
    plano: planoSelecionado
  })
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      setError("As senhas não coincidem")
      return
    }

    if (formData.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      if (tipo === "barbearia") {
        const res = await fetch("/api/barbershops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.nomeBarbearia || formData.nome,
            email: formData.email,
            phone: formData.telefone?.replace(/\D/g, "") ? formData.telefone : undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Erro ao criar barbearia")
        }
        const barbershop = await res.json()
        const sessionRes = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barbershop_id: barbershop.id }),
        })
        if (!sessionRes.ok) {
          const err = await sessionRes.json().catch(() => ({}))
          throw new Error(err.error || "Erro ao iniciar sessão")
        }
        router.push("/painel")
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500))
        router.push("/")
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao criar conta. Tente novamente."
      const isTableError = typeof msg === "string" && (msg.includes("schema cache") || msg.includes("could not find the table") || msg.includes("barbershops"))
      setError(
        isTableError
          ? "Falta criar as tabelas no Supabase. Abra o Supabase → SQL Editor → New query → copie TODO o conteúdo do arquivo supabase/CRIAR_TABELAS_SUPABASE.sql do projeto, cole no editor e clique em Run. Depois tente o cadastro de novo."
          : msg
      )
    } finally {
      setIsLoading(false)
    }
  }

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12">
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
            <div className="flex justify-center mb-4">
              <BrandLogo size="lg" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Criar Conta</h1>
            <p className="text-muted-foreground">
              {tipo === "barbearia"
                ? "Cadastre sua barbearia no Trim Time"
                : "Crie sua conta para agendar"
              }
            </p>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Progress steps */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>
                {step > 1 ? <Check className="w-4 h-4" /> : "1"}
              </div>
              <div className={`w-12 h-0.5 ${step >= 2 ? "bg-primary" : "bg-border"}`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 2 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>
                2
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              {tipo === "cliente" && (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="nome">Nome completo</FieldLabel>
                    <Input
                      id="nome"
                      type="text"
                      placeholder="Seu nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </Field>

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
                    <FieldLabel htmlFor="telefone">Telefone</FieldLabel>
                    <Input
                      id="telefone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: formatPhone(e.target.value) })}
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="password">Senha</FieldLabel>
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

                  <Field>
                    <FieldLabel htmlFor="confirmPassword">Confirmar Senha</FieldLabel>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </Field>
                </FieldGroup>
              )}

              {tipo === "barbearia" && step === 1 && (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="nome">Seu nome</FieldLabel>
                    <Input
                      id="nome"
                      type="text"
                      placeholder="Seu nome completo"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </Field>

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
                    <FieldLabel htmlFor="telefone">Telefone</FieldLabel>
                    <Input
                      id="telefone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: formatPhone(e.target.value) })}
                      required
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="password">Senha</FieldLabel>
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

                  <Field>
                    <FieldLabel htmlFor="confirmPassword">Confirmar Senha</FieldLabel>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </Field>
                </FieldGroup>
              )}

              {tipo === "barbearia" && step === 2 && (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="nomeBarbearia">Nome da Barbearia</FieldLabel>
                    <Input
                      id="nomeBarbearia"
                      type="text"
                      placeholder="Ex: Barbearia do João"
                      value={formData.nomeBarbearia}
                      onChange={(e) => setFormData({ ...formData, nomeBarbearia: e.target.value })}
                      required
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="endereco">Endereço (opcional)</FieldLabel>
                    <Input
                      id="endereco"
                      type="text"
                      placeholder="Rua, número, bairro"
                      value={formData.endereco}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="cidade">Cidade (opcional)</FieldLabel>
                    <Input
                      id="cidade"
                      type="text"
                      placeholder="Sua cidade"
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Plano desejado</FieldLabel>
                    <p className="text-xs text-muted-foreground mb-2">
                      Escolha o plano que melhor atende sua barbearia.
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "basic", name: "Básico", price: "R$19", desc: "/mês" },
                        { id: "pro", name: "Pro", price: "R$39", desc: "/mês" },
                        { id: "premium", name: "Premium", price: "R$79", desc: "/mês" }
                      ].map((plan) => (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, plano: plan.id })}
                          className={`p-3 rounded-lg border text-center transition-colors ${
                            formData.plano === plan.id
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <p className="text-xs font-medium text-foreground">{plan.name}</p>
                          <p className="text-sm font-bold text-primary">{plan.price}</p>
                          <p className="text-xs text-muted-foreground">{plan.desc}</p>
                        </button>
                      ))}
                    </div>
                  </Field>
                </FieldGroup>
              )}

              {tipo === "barbearia" && step === 1 ? (
                <Button 
                  type="button"
                  onClick={() => {
                    if (formData.password !== formData.confirmPassword) {
                      setError("As senhas não coincidem")
                      return
                    }
                    if (formData.password.length < 6) {
                      setError("A senha deve ter pelo menos 6 caracteres")
                      return
                    }
                    setError("")
                    setStep(2)
                  }}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Continuar
                </Button>
              ) : tipo === "barbearia" && step === 2 ? (
                <div className="space-y-3">
                  <Button 
                    type="submit" 
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? "Criando conta..." : "Criar Conta"}
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="w-full border-border text-foreground hover:bg-secondary"
                  >
                    Voltar
                  </Button>
                </div>
              ) : (
                <Button 
                  type="submit" 
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? "Criando conta..." : "Criar Conta"}
                </Button>
              )}
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Já tem uma conta?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Entrar
              </Link>
            </p>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Ao criar uma conta, você concorda com nossos{" "}
              <Link href="/termos" className="text-primary hover:underline">
                Termos de Uso
              </Link>{" "}
              e{" "}
              <Link href="/privacidade" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function CadastroPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-muted-foreground text-sm animate-pulse">Carregando…</div>
        </div>
      }
    >
      <CadastroPageContent />
    </Suspense>
  )
}
