"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ACCOUNT_DELETE_PHRASE } from "@/lib/account-delete-confirm"

type DeleteAccountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  barbershopName: string
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  barbershopName,
}: DeleteAccountDialogProps) {
  const router = useRouter()
  const [issueLoading, setIssueLoading] = useState(false)
  const [issueCode, setIssueCode] = useState<string | null>(null)
  const [issueSession, setIssueSession] = useState<string | null>(null)
  const [emailHint, setEmailHint] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState<boolean | null>(null)
  const [confirmCode, setConfirmCode] = useState("")
  const [phrase, setPhrase] = useState("")
  const [acknowledged, setAcknowledged] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setIssueLoading(false)
    setIssueCode(null)
    setIssueSession(null)
    setEmailHint(null)
    setEmailSent(null)
    setConfirmCode("")
    setPhrase("")
    setAcknowledged(false)
    setCopiedCode(false)
    setBusy(false)
    setError(null)
  }, [])

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const issueCodeRequest = async () => {
    setIssueLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/delete-account/request", { method: "POST" })
      const data = (await res.json()) as {
        code?: string
        session?: string
        email?: string
        email_sent?: boolean
        email_error?: string
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? "Não foi possível gerar o código.")
        setIssueCode(null)
        setIssueSession(null)
        return
      }
      setIssueCode(data.code ?? null)
      setIssueSession(data.session ?? null)
      setEmailHint(data.email ?? null)
      setEmailSent(data.email_sent === true)
      if (data.email_sent === false && data.email_error) {
        setError(`Código gerado, mas o e-mail não foi enviado: ${data.email_error}`)
      }
    } catch {
      setError("Erro de rede ao gerar código.")
    } finally {
      setIssueLoading(false)
    }
  }

  const copyIssueCode = async () => {
    if (!issueCode) return
    try {
      await navigator.clipboard.writeText(issueCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const confirmDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/delete-account/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: confirmCode,
          session: issueSession,
          phrase,
          acknowledged,
        }),
      })
      const data = (await res.json()) as { error?: string; warnings?: string[] }
      if (!res.ok) {
        setError(data.error ?? "Não foi possível excluir a conta.")
        return
      }
      handleOpenChange(false)
      router.push("/login?deleted=1")
    } catch {
      setError("Erro de rede ao excluir conta.")
    } finally {
      setBusy(false)
    }
  }

  const canConfirm =
    !!issueSession &&
    confirmCode.trim().length === 6 &&
    phrase.trim().toUpperCase() === ACCOUNT_DELETE_PHRASE &&
    acknowledged

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Excluir conta
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                A barbearia <strong className="text-foreground">{barbershopName}</strong> será
                apagada permanentemente, incluindo agenda, clientes, barbeiros, financeiro e
                assinatura.
              </p>
              <p>Esta ação não pode ser desfeita.</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Gere um código de confirmação (aparece aqui e também no e-mail da conta).
            </p>
            {issueLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando código…
              </div>
            ) : issueCode ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-center text-2xl font-bold tracking-[0.35em] text-destructive bg-background rounded-md py-3 px-2 border border-border">
                    {issueCode}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => void copyIssueCode()}
                    title="Copiar código"
                  >
                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                {emailHint ? (
                  <p className="text-xs text-muted-foreground">
                    {emailSent
                      ? `Código enviado para ${emailHint}.`
                      : `E-mail não enviado — use o código exibido acima.`}
                  </p>
                ) : null}
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void issueCodeRequest()}
              >
                Gerar código e enviar e-mail
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-confirm-code">Cole o código aqui</Label>
            <Input
              id="delete-confirm-code"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000000"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-lg tracking-widest text-center font-mono"
              disabled={!issueSession}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-phrase">
              Digite <span className="font-mono font-semibold">{ACCOUNT_DELETE_PHRASE}</span> para
              confirmar
            </Label>
            <Input
              id="delete-phrase"
              type="text"
              autoComplete="off"
              placeholder={ACCOUNT_DELETE_PHRASE}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              disabled={!issueSession}
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
              disabled={!issueSession}
              className="mt-0.5"
            />
            <span className="text-sm text-muted-foreground leading-snug">
              Entendo que todos os dados serão apagados permanentemente e não poderei recuperá-los.
            </span>
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm || busy}
            onClick={() => void confirmDelete()}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Excluindo…
              </>
            ) : (
              "Excluir permanentemente"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
