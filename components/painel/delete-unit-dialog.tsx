"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { BarbershopUnit } from "@/lib/db/types"
import {
  deleteConfirmCodesMatch,
  formatDeleteConfirmCodeDisplay,
  generateDeleteConfirmCode,
  normalizeDeleteConfirmCode,
} from "@/lib/delete-confirm-code"

type DeleteUnitDialogProps = {
  unit: BarbershopUnit | null
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}

export function DeleteUnitDialog({
  unit,
  open,
  busy,
  onOpenChange,
  onConfirm,
}: DeleteUnitDialogProps) {
  const [confirmCode, setConfirmCode] = useState("")
  const [expectedCode, setExpectedCode] = useState("")

  useEffect(() => {
    if (!open || !unit) return
    setConfirmCode("")
    setExpectedCode(generateDeleteConfirmCode())
  }, [open, unit?.id])

  const codeOk = useMemo(
    () => deleteConfirmCodesMatch(expectedCode, confirmCode),
    [expectedCode, confirmCode]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden />
            Excluir unidade
          </DialogTitle>
        </DialogHeader>

        {unit ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
              <p className="text-foreground">
                Você está prestes a excluir a unidade{" "}
                <strong className="font-semibold">{unit.name}</strong>.
              </p>
              <p className="text-destructive font-medium mt-1">
                Essa ação não pode ser desfeita.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Para confirmar, digite o código abaixo:
              </p>
              <p
                className="font-mono text-lg tracking-[0.35em] text-center py-3 rounded-lg border border-border bg-secondary/30 text-foreground select-all"
                aria-label={`Código de confirmação: ${formatDeleteConfirmCodeDisplay(expectedCode)}`}
              >
                {formatDeleteConfirmCodeDisplay(expectedCode)}
              </p>
              <Input
                className="bg-input border-border text-foreground text-center font-mono tracking-widest uppercase"
                placeholder="Digite o código (com ou sem espaços)"
                value={confirmCode}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={busy}
                onChange={(e) =>
                  setConfirmCode(normalizeDeleteConfirmCode(e.target.value))
                }
              />
              {confirmCode.length > 0 ? (
                codeOk ? (
                  <p className="text-xs text-emerald-500 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" aria-hidden />
                    Código correto — pode excluir com segurança
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    O código ainda não confere. Digite exatamente as letras acima.
                  </p>
                )
              ) : null}
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-border text-foreground"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!unit || !codeOk || busy}
            onClick={() => void onConfirm()}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />
                Excluindo…
              </>
            ) : (
              "Excluir unidade"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
