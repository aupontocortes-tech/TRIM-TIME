"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Eye, EyeOff, ArrowLeft, Mail, Store } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { SignupProgress } from "@/components/onboarding/signup-progress"
import type { SignupFlowStep } from "@/lib/onboarding"
import { TRIAL_DAYS, TRIAL_OFFER_HEADLINE } from "@/lib/plans"
import { PainelOAuthButtons } from "@/components/auth/painel-oauth-buttons"

function CadastroPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tipo = searchParams.get("tipo") || "barbearia" // barbearia ou cliente

  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  type BarbeariaStep = "dados" | "otp" | "barbearia"
  const [barbeariaStep, setBarbeariaStep] = useState<BarbeariaStep>("dados")
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    password: "",
    confirmPassword: "",
    nomeBarbearia: "",
  })
  const [error, setError] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [signupToken, setSignupToken] = useState("")
  const [otpSending, setOtpSending] = useState(false)
  const [emailCanonicalDisplay, setEmailCanonicalDisplay] = useState("")
  const [oauthVerified, setOauthVerified] = useState(false)

  useEffect(() => {
    if (tipo !== "barbearia") return
    const emailParam = searchParams.get("email")
    if (emailParam) {
      setFormData((prev) => ({ ...prev, email: emailParam.trim() }))
    }
    if (searchParams.get("oauth") !== "1") return

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/auth/painel-signup/session", { credentials: "include" })
        const j = await res.json().catch(() => ({}))
        if (cancelled || !res.ok || !j.ok) return
        if (typeof j.signup_token === "string") setSignupToken(j.signup_token)
        if (typeof j.email_canonical === "string") setEmailCanonicalDisplay(j.email_canonical)
        setOauthVerified(true)
        setBarbeariaStep("dados")
        setError("")
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tipo, searchParams])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [barbeariaStep])

  useEffect(() => {
    if (typeof document === "undefined") return
    if (tipo === "barbearia" && barbeariaStep === "otp") {
      queueMicrotask(() => document.getElementById("otp-code-input")?.focus())
    }
  }, [tipo, barbeariaStep])

  const normalizeEmail = (raw: string) => raw.trim().toLowerCase()

  const handleContinueBarbeariaDados = async () => {
    if (!formData.nome.trim()) {
      setError("Informe seu nome.")
      return
    }
    if (!formData.email.trim()) {
      setError("Informe seu e-mail.")
      return
    }
    if (!oauthVerified) {
      if (formData.password !== formData.confirmPassword) {
        setError("As senhas não coincidem.")
        return
      }
      if (formData.password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.")
        return
      }
    }
    const telDig = formData.telefone.replace(/\D/g, "")
    if (telDig.length < 10) {
      setError("Informe um celular válido com DDD (para segurança e contato da conta).")
      return
    }
    setError("")
    if (oauthVerified && signupToken) {
      setBarbeariaStep("barbearia")
      return
    }
    setOtpSending(true)
    try {
      const res = await fetch("/api/auth/painel-signup/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim(),
          phone: formData.telefone.trim() || undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Não foi possível enviar o código.")
      setOtpCode("")
      const displayEmail =
        typeof j.email_for_otp === "string" && j.email_for_otp
          ? j.email_for_otp
          : typeof j.email_canonical === "string" && j.email_canonical
            ? j.email_canonical
            : normalizeEmail(formData.email)
      setEmailCanonicalDisplay(displayEmail)
      setBarbeariaStep("otp")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar código.")
    } finally {
      setOtpSending(false)
    }
  }

  const handleResendPainelOtp = async () => {
    await handleContinueBarbeariaDados()
  }

  const handleVerifyPainelOtp = async () => {
    const code = otpCode.trim()
    if (!code) {
      setError("Informe o código enviado para o seu e-mail.")
      return
    }
    setIsLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/painel-signup/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: formData.email.trim(), code }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Código inválido ou expirado.")
      const token = typeof j.signup_token === "string" ? j.signup_token : ""
      if (!token) throw new Error("Resposta inválida do servidor.")
      if (typeof j.email_canonical === "string" && j.email_canonical) {
        setEmailCanonicalDisplay(j.email_canonical)
      }
      setSignupToken(token)
      setBarbeariaStep("barbearia")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao verificar código.")
    } finally {
      setIsLoading(false)
    }
  }

  /** Cria conta + sessão — só chamado no passo 3. */
  const finalizeBarbeariaSignup = async () => {
    if (!signupToken) {
      setError("Confirme o e-mail com o código antes de criar a conta.")
      return
    }
    setIsLoading(true)
    setError("")
    try {
      const digits = formData.telefone.replace(/\D/g, "")
      const res = await fetch("/api/barbershops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.nomeBarbearia.trim(),
          email: formData.email.trim(),
          phone: digits || undefined,
          ...(formData.password.trim() ? { password: formData.password } : {}),
          painel_signup_token: signupToken,
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
        credentials: "include",
        body: JSON.stringify({ barbershop_id: barbershop.id }),
      })
      if (!sessionRes.ok) {
        const err = await sessionRes.json().catch(() => ({}))
        throw new Error(err.error || "Erro ao iniciar sessão")
      }
      await sessionRes.json().catch(() => ({}))
      const isSuperAdmin = barbershop.role === "super_admin"
      if (typeof window !== "undefined") {
        window.location.assign(isSuperAdmin ? "/painel" : "/painel/assinatura?setup=card")
        return
      }
      router.push(isSuperAdmin ? "/painel" : "/painel/assinatura?setup=card")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao criar conta. Tente novamente."
      const isTableError =
        typeof msg === "string" &&
        (msg.includes("schema cache") ||
          msg.includes("could not find the table") ||
          msg.includes("barbershops") ||
          msg.includes("painel_signup_tokens") ||
          msg.includes("painel_signup_otp_sends"))
      setError(
        isTableError
          ? "Falta atualizar o banco (novas tabelas de OTP de cadastro e/ou tabelas do Trim Time). No projeto, rode prisma db push contra o Postgres do Supabase ou aplique migrações, depois tente de novo."
          : msg
      )
    } finally {
      setIsLoading(false)
    }
  }

  const finalizeClienteSignup = async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 500))
      router.push("/")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormWizardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (tipo === "barbearia") {
      if (barbeariaStep === "dados") {
        await handleContinueBarbeariaDados()
        return
      }
      if (barbeariaStep === "otp") {
        await handleVerifyPainelOtp()
        return
      }
      await finalizeBarbeariaSignup()
      return
    }
    await finalizeClienteSignup()
  }

  const signupFlowStep: SignupFlowStep =
    barbeariaStep === "dados" ? "dados" : barbeariaStep === "otp" ? "otp" : "barbearia"

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
            <p className="text-muted-foreground text-sm leading-relaxed">
              {tipo === "barbearia"
                ? `${TRIAL_OFFER_HEADLINE}. Cadastro rápido. Cartão só na etapa final, sem cobrança imediata.`
                : "Crie sua conta para agendar"
              }
            </p>
          </CardHeader>

          <CardContent className="pt-6">
            {tipo === "barbearia" ? (
              <>
              <SignupProgress current={signupFlowStep} className="mb-6" />
              <div className="hidden mb-5 space-y-3">
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-muted-foreground">
                  <span
                    className={
                      barbeariaStep === "dados"
                        ? "font-semibold text-primary"
                        : "opacity-80 text-primary/80"
                    }
                  >
                    __REMOVE_STEP__
                  </span>
                  <span className="opacity-40">→</span>
                  <span
                    className={
                      barbeariaStep === "otp" ? "font-semibold text-primary" : ""
                    }
                  >
                    ② Código no e-mail
                  </span>
                  <span className="opacity-40">→</span>
                  <span className={barbeariaStep === "barbearia" ? "font-semibold text-primary" : ""}>
                    ③ Nome da barbearia
                  </span>
                </div>
              </div>
              </>
            ) : null}

            <form onSubmit={(e) => void handleFormWizardSubmit(e)} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              {tipo === "barbearia" ? (
                <div
                  className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 text-left"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {barbeariaStep === "dados" &&
                      (oauthVerified
                        ? "E-mail confirmado com Google/Facebook. Complete nome, celular e nome da barbearia."
                        : "Comece com o básico: nome, e-mail, celular e senha.")}
                    {barbeariaStep === "otp" &&
                      "Enviamos um código de 6 dígitos para o seu e-mail. Digite só os números abaixo — não precisa clicar em nenhum link do e-mail (apps de e-mail teste costumam mostrar um botão de link; ignore). Confira também Spam."}
                    {barbeariaStep === "barbearia" &&
                      `Por último, o nome da barbearia. Depois você cadastra o cartão para ativar os ${TRIAL_DAYS} dias grátis no Pro.`}
                  </p>
                </div>
              ) : null}

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

              {tipo === "barbearia" && barbeariaStep === "dados" && (
                <>
              {!oauthVerified ? (
                <PainelOAuthButtons flow="signup" disabled={isLoading || otpSending} />
              ) : null}
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
                      readOnly={oauthVerified}
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

                  {!oauthVerified ? (
                    <>
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
                          onChange={(e) =>
                            setFormData({ ...formData, confirmPassword: e.target.value })
                          }
                          required
                          className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                        />
                      </Field>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground rounded-md border border-border/80 bg-muted/30 px-3 py-2">
                      E-mail confirmado com rede social — senha opcional neste passo.
                    </p>
                  )}
                </FieldGroup>
                </>
              )}

              {tipo === "barbearia" && barbeariaStep === "otp" && (
                <FieldGroup>
                  <p className="text-sm text-muted-foreground">
                    Use o mesmo e-mail:{" "}
                    <strong className="break-all text-foreground">
                      {emailCanonicalDisplay || normalizeEmail(formData.email)}
                    </strong>
                  </p>
                  <p className="text-xs text-muted-foreground rounded-md border border-border/80 bg-muted/30 px-3 py-2">
                    O cadastro valida apenas o <strong className="text-foreground">código numérico</strong> nesta
                    tela. Se o e-mail tiver um link para abrir o site ou o app, você pode ignorar — não substitui o
                    código.
                  </p>
                  <Field>
                    <FieldLabel htmlFor="otp-code-input" className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" aria-hidden />
                      Código de verificação (e-mail)
                    </FieldLabel>
                    <Input
                      id="otp-code-input"
                      inputMode="text"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      maxLength={10}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\s+/g, ""))}
                      className="text-center text-xl tracking-[0.4em] font-mono bg-input border-border text-foreground"
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={otpSending || isLoading}
                    onClick={() => void handleResendPainelOtp()}
                  >
                    {otpSending ? "Enviando…" : "Enviar código de novo"}
                  </Button>
                </FieldGroup>
              )}

              {tipo === "barbearia" && barbeariaStep === "barbearia" && (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="nomeBarbearia" className="flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5" aria-hidden />
                      Nome da barbearia
                    </FieldLabel>
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
                </FieldGroup>
              )}

              {tipo === "barbearia" && barbeariaStep === "dados" ? (
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={otpSending || isLoading}
                >
                  {otpSending ? "Enviando código…" : "Enviar código por e-mail"}
                </Button>
              ) : tipo === "barbearia" && barbeariaStep === "otp" ? (
                <div className="space-y-3">
                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? "Verificando…" : "Confirmar código e continuar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setError("")
                      setBarbeariaStep("dados")
                    }}
                    className="w-full border-border text-foreground hover:bg-secondary"
                  >
                    Voltar
                  </Button>
                </div>
              ) : tipo === "barbearia" && barbeariaStep === "barbearia" ? (
                <div className="space-y-3">
                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? "Criando conta…" : "Criar conta e ir para assinatura"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setError("")
                      setBarbeariaStep("otp")
                    }}
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
