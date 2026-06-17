"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Lock } from "lucide-react"

type SecurityState = {
  email: string
  has_password: boolean
  role?: string
}

type ChangePasswordFormProps = {
  variant?: "default" | "platform"
  title?: string
  description?: string
}

export function ChangePasswordForm({
  variant = "default",
  title = "Senha de acesso",
  description = "Entre com Google ou com e-mail e senha. Aqui você define ou troca a senha do painel.",
}: ChangePasswordFormProps) {
  const [security, setSecurity] = useState<SecurityState | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch("/api/auth/account-security", { credentials: "include" })
      const j = (await r.json().catch(() => ({}))) as SecurityState & { error?: string }
      if (!r.ok) {
        setErr(j.error || "Não foi possível carregar")
        setSecurity(null)
        return
      }
      setSecurity(j)
    } catch {
      setErr("Erro de rede")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!r.ok) {
        setErr(j.error || "Não foi possível salvar")
        return
      }
      setMsg(j.message || "Senha salva.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      await load()
    } catch {
      setErr("Erro de rede")
    } finally {
      setBusy(false)
    }
  }

  const isPlatform = variant === "platform"
  const inputClass = isPlatform
    ? "bg-zinc-900 border-zinc-700 text-white"
    : "bg-background border-border text-foreground"
  const errClass = isPlatform
    ? "text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-md p-3"
    : "text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3"
  const okClass = isPlatform
    ? "text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 rounded-md p-3"
    : "text-sm text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/30 rounded-md p-3"

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className={`w-8 h-8 animate-spin ${isPlatform ? "text-zinc-500" : "text-muted-foreground"}`} />
      </div>
    )
  }

  return (
    <Card className={isPlatform ? "bg-zinc-950 border-[#D4AF37]/35 text-white" : "bg-card border-border"}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${isPlatform ? "text-white" : "text-foreground"}`}>
          <Lock className="w-5 h-5" />
          {title}
        </CardTitle>
        <CardDescription className={isPlatform ? "text-zinc-400" : "text-muted-foreground"}>
          {description}
        </CardDescription>
        {security?.email ? (
          <p className={`text-xs pt-1 ${isPlatform ? "text-zinc-500" : "text-muted-foreground"}`}>
            Conta: <span className={isPlatform ? "text-zinc-300" : "text-foreground"}>{security.email}</span>
            {" · "}
            {security.has_password ? "Senha ativa" : "Sem senha — use Google ou defina abaixo"}
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        {err ? <p className={`${errClass} mb-4`}>{err}</p> : null}
        {msg ? <p className={`${okClass} mb-4`}>{msg}</p> : null}

        <form onSubmit={submit} className="space-y-4 max-w-md">
          {security?.has_password ? (
            <div>
              <Label htmlFor="current-password" className={isPlatform ? "text-zinc-300" : undefined}>
                Senha atual
              </Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                className={`mt-1.5 ${inputClass}`}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
          ) : null}

          <div>
            <Label htmlFor="new-password" className={isPlatform ? "text-zinc-300" : undefined}>
              {security?.has_password ? "Nova senha" : "Definir senha"}
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className={`mt-1.5 ${inputClass}`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <div>
            <Label htmlFor="confirm-password" className={isPlatform ? "text-zinc-300" : undefined}>
              Confirmar senha
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              className={`mt-1.5 ${inputClass}`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <Button
            type="submit"
            disabled={busy}
            className={isPlatform ? "bg-[#D4AF37] text-black hover:bg-[#c9a432]" : undefined}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {security?.has_password ? "Alterar senha" : "Definir senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
