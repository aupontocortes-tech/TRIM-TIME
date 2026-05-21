"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import {
  loadClientOAuthRegisterDraft,
  saveClientOAuthRegisterDraft,
} from "@/lib/client-oauth-storage"
import { clientPhoneDigits } from "@/lib/client-phone-utils"

type Provider = "google" | "facebook"
type ClientOAuthMode = "login" | "register"

const LABELS: Record<Provider, string> = {
  google: "Continuar com Google",
  facebook: "Continuar com Facebook",
}

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
  const [loading, setLoading] = useState<Provider | null>(null)
  const [error, setError] = useState("")

  const start = async (provider: Provider) => {
    setError("")
    if (mode === "register") {
      const nome = registerNome?.trim() ?? ""
      const tel = registerTelefone?.trim() ?? ""
      if (!nome || clientPhoneDigits(tel).length < 10) {
        onNeedRegisterData?.()
        setError("Preencha nome e WhatsApp antes de usar Google ou Facebook (ou preencha após voltar do login social).")
        return
      }
      saveClientOAuthRegisterDraft(slug, { nome, telefone: tel })
    } else {
      const draft = loadClientOAuthRegisterDraft(slug)
      if (draft) saveClientOAuthRegisterDraft(slug, draft)
    }

    setLoading(provider)
    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback?flow=client&slug=${encodeURIComponent(slug)}&mode=${mode}`
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      })
      if (oauthErr) {
        setError(oauthErr.message || "Não foi possível abrir o login social.")
        setLoading(null)
        return
      }
      if (data?.url) window.location.assign(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao iniciar login social.")
      setLoading(null)
    }
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      ) : null}
      {(["google", "facebook"] as const).map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          className="w-full border-border"
          disabled={disabled || loading !== null}
          onClick={() => void start(provider)}
        >
          {loading === provider ? "Abrindo…" : LABELS[provider]}
        </Button>
      ))}
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">ou código por e-mail</span>
        </div>
      </div>
    </div>
  )
}
