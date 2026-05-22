"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { saveClientOAuthRegisterDraft } from "@/lib/client-oauth-storage"
import { clientPhoneDigits } from "@/lib/client-phone-utils"
import { GoogleSignInButton, OAuthDivider } from "@/components/auth/google-sign-in-button"

type ClientOAuthMode = "login" | "register"

export function ClientOAuthButtons({
  slug,
  mode,
  disabled,
  registerNome,
  registerTelefone,
}: {
  slug: string
  mode: ClientOAuthMode
  disabled?: boolean
  registerNome?: string
  registerTelefone?: string
  onNeedRegisterData?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const startGoogle = async () => {
    setError("")
    const nome = registerNome?.trim() ?? ""
    const tel = registerTelefone?.trim() ?? ""
    if (mode === "register" && nome && clientPhoneDigits(tel).length >= 10) {
      saveClientOAuthRegisterDraft(slug, { nome, telefone: tel })
    }

    setLoading(true)
    try {
      const prep = await fetch(
        `/api/public/barbershops/${encodeURIComponent(slug)}/auth-oauth-prepare`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            mode,
            ...(nome ? { nome } : {}),
            ...(tel ? { telefone: tel } : {}),
          }),
        }
      )
      if (!prep.ok) {
        const j = await prep.json().catch(() => ({}))
        throw new Error(
          typeof (j as { error?: string }).error === "string"
            ? (j as { error: string }).error
            : "Não foi possível iniciar o login com Google."
        )
      }

      const supabase = createClient()
      const slugEnc = encodeURIComponent(slug.trim())
      const redirectTo = `${window.location.origin}/auth/callback/client/${slugEnc}?mode=${mode}`
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
        label={mode === "register" ? "Cadastrar com Google" : "Entrar com Google"}
      />
      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      ) : null}
      <OAuthDivider label="ou código por e-mail" />
    </div>
  )
}
