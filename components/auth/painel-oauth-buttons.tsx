"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { GoogleSignInButton, OAuthDivider } from "@/components/auth/google-sign-in-button"

type PainelOAuthFlow = "login" | "signup"

export function PainelOAuthButtons({
  flow,
  disabled,
}: {
  flow: PainelOAuthFlow
  disabled?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const startGoogle = async () => {
    setError("")
    setLoading(true)
    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback?flow=${flow}`
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: false },
      })
      if (oauthErr) {
        setError(oauthErr.message || "Não foi possível abrir o login com Google.")
        setLoading(false)
        return
      }
      if (data?.url) {
        window.location.assign(data.url)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao iniciar login com Google.")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-center text-muted-foreground">
        Acesso rápido com sua conta Google (Gmail)
      </p>
      <GoogleSignInButton
        onClick={() => void startGoogle()}
        disabled={disabled}
        loading={loading}
        label={flow === "signup" ? "Cadastrar com Google" : "Entrar com Google"}
      />
      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      ) : null}
      <OAuthDivider label="ou use e-mail" />
    </div>
  )
}
