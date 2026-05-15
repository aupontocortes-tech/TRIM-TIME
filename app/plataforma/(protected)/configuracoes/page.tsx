"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, MessageCircle } from "lucide-react"

const GOLD = "#D4AF37"

export default function PlataformaConfiguracoesPage() {
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch("/api/admin/platform-settings", { credentials: "include" })
      const j = (await r.json().catch(() => ({}))) as {
        landing_whatsapp_phone?: string
        error?: string
      }
      if (!r.ok) {
        setErr(j.error || "Não foi possível carregar")
        return
      }
      setPhone(j.landing_whatsapp_phone ?? "")
    } catch {
      setErr("Erro de rede")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    setErr(null)
    try {
      const r = await fetch("/api/admin/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ landing_whatsapp_phone: phone }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error || "Não foi possível salvar")
        return
      }
      setMsg("Salvo. O botão da página de vendas usará este número.")
    } catch {
      setErr("Erro de rede")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações da plataforma</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Ajustes globais da landing e do site público
        </p>
      </div>

      <Card className="bg-zinc-950 border-[#D4AF37]/35 text-white max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <MessageCircle className="w-5 h-5" style={{ color: GOLD }} />
            WhatsApp — Tirar dúvidas
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Número usado no botão &quot;Tirar dúvidas: fale conosco&quot; na página inicial. Deixe vazio
            para ocultar o botão até configurar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
          ) : (
            <form onSubmit={save} className="space-y-4">
              {err ? (
                <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-md p-3">
                  {err}
                </p>
              ) : null}
              {msg ? (
                <p className="text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 rounded-md p-3">
                  {msg}
                </p>
              ) : null}
              <div>
                <Label htmlFor="wa-phone" className="text-zinc-300">
                  WhatsApp (com DDD)
                </Label>
                <Input
                  id="wa-phone"
                  type="tel"
                  className="mt-1.5 bg-zinc-900 border-zinc-700 text-white"
                  placeholder="11 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
                <p className="text-xs text-zinc-500 mt-1.5">
                  Ex.: 11999998888 ou +55 11 99999-8888
                </p>
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#D4AF37] text-black hover:bg-[#c9a432]"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar número
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
