"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DeleteAccountDialog } from "@/components/delete-account-dialog"

type DeleteAccountSectionProps = {
  /** Fallback enquanto a API carrega. */
  barbershopName?: string
}

type DeleteAccessState = {
  barbershop_name: string
  can_delete_account: boolean
  delete_account_blocked_reason?: string
}

export function DeleteAccountSection({ barbershopName = "" }: DeleteAccountSectionProps) {
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState<DeleteAccessState | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/auth/account-security", { credentials: "include", cache: "no-store" })
      const j = (await r.json().catch(() => ({}))) as DeleteAccessState & { error?: string }
      if (!r.ok) {
        setAccess(null)
        return
      }
      setAccess({
        barbershop_name: j.barbershop_name || barbershopName,
        can_delete_account: j.can_delete_account === true,
        delete_account_blocked_reason: j.delete_account_blocked_reason,
      })
    } catch {
      setAccess(null)
    } finally {
      setLoading(false)
    }
  }, [barbershopName])

  useEffect(() => {
    void load()
  }, [load])

  const displayName = access?.barbershop_name || barbershopName

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!displayName) return null

  if (access && !access.can_delete_account) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <Trash2 className="w-5 h-5" />
            Excluir conta
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {access.delete_account_blocked_reason ??
              "Esta conta não pode ser excluída pelo painel."}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!access?.can_delete_account) return null

  return (
    <>
      <Card className="bg-card border-destructive/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Excluir conta
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Apaga permanentemente a barbearia <strong className="text-foreground">{displayName}</strong>,
            incluindo agenda, clientes, barbeiros, financeiro e assinatura. Esta ação não pode ser desfeita.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
            Excluir minha conta
          </Button>
        </CardContent>
      </Card>

      <DeleteAccountDialog open={open} onOpenChange={setOpen} barbershopName={displayName} />
    </>
  )
}
