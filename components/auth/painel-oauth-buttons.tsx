"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
type Provider = "google" | "facebook"
type PainelOAuthFlow = "login" | "signup"

const LABELS: Record<Provider, string> = {
  google: "Continuar com Google",
  facebook: "Continuar com Facebook",
}

export function PainelOAuthButtons({
  flow,
  disabled,
}: {
  flow: PainelOAuthFlow
  disabled?: boolean
}) {
  const [loading, setLoading] = useState<Provider | null>(null)
  const [error, setError] = useState("")

  const start = async (provider: Provider) => {
    setError("")
    setLoading(provider)
    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback?flow=${flow}`
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: false },
      })
      if (oauthErr) {
        setError(oauthErr.message || "Não foi possível abrir o login social.")
        setLoading(null)
        return
      }
      if (data?.url) {
        window.location.assign(data.url)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao iniciar login social.")
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2">
        {(["google", "facebook"] as const).map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            className="w-full"
            disabled={disabled || loading !== null}
            onClick={() => void start(provider)}
          >
            {loading === provider ? "Abrindo…" : LABELS[provider]}
          </Button>
        ))}
      </div>
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">ou</span>
        </div>
      </div>
    </div>
  )
}
