"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { GoogleSignInButton, OAuthDivider } from "@/components/auth/google-sign-in-button"

type BarberOAuthTarget =
  | { kind: "portal"; portalToken: string }
  | { kind: "invite"; inviteToken: string }

export function BarberOAuthButtons({
  target,
  disabled,
  mode,
}: {
  target: BarberOAuthTarget
  disabled?: boolean
  mode: "login" | "register"
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const startGoogle = async () => {
    setError("")
    setLoading(true)
    try {
      const prepareUrl =
        target.kind === "portal"
          ? `/api/public/barber-portal/${encodeURIComponent(target.portalToken)}/auth-oauth-prepare`
          : `/api/public/barber-invite/${encodeURIComponent(target.inviteToken)}/auth-oauth-prepare`

      const prep = await fetch(prepareUrl, {
        method: "POST",
        credentials: "include",
      })
      if (!prep.ok) {
        const j = await prep.json().catch(() => ({}))
        throw new Error(
          typeof (j as { error?: string }).error === "string"
            ? (j as { error: string }).error
            : "Não foi possível iniciar o login com Google."
        )
      }

      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback/barber`
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      })
      if (oauthErr) {
        setError(oauthErr.message || "Não foi possível abrir o login com Google.")
        setLoading(false)
        return
      }
      if (data?.url) window.location.assign(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao iniciar login com Google.")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <GoogleSignInButton
        onClick={() => void startGoogle()}
        disabled={disabled}
        loading={loading}
        label={mode === "register" ? "Continuar com Google" : "Entrar com Google"}
      />
      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      ) : null}
      <OAuthDivider label={mode === "register" ? "ou preencha o formulário" : "ou código por e-mail"} />
    </div>
  )
}
