"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  loadClientOAuthRegisterDraft,
  saveClientOAuthRegisterDraft,
} from "@/lib/client-oauth-storage"
import { clientPhoneDigits } from "@/lib/client-phone-utils"
import { GoogleSignInButton, OAuthDivider } from "@/components/auth/google-sign-in-button"

type ClientOAuthMode = "login" | "register"

export function ClientOAuthButtons({
  slug,
  mode,
  disabled,
  registerNome,
  registerTelefone,
  onNeedRegisterData,
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
    if (mode === "register") {
      const nome = registerNome?.trim() ?? ""
      const tel = registerTelefone?.trim() ?? ""
      if (!nome || clientPhoneDigits(tel).length < 10) {
        onNeedRegisterData?.()
        setError(
          "Preencha nome e WhatsApp acima antes do Google (ou complete após voltar do login)."
        )
        return
      }
      saveClientOAuthRegisterDraft(slug, { nome, telefone: tel })
    } else {
      const draft = loadClientOAuthRegisterDraft(slug)
      if (draft) saveClientOAuthRegisterDraft(slug, draft)
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback?flow=client&slug=${encodeURIComponent(slug)}&mode=${mode}`
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
