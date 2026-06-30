"use client"

import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DeleteAccountDialog } from "@/components/delete-account-dialog"

type DeleteAccountSectionProps = {
  barbershopName: string
  role?: string
  isTest?: boolean
}

export function DeleteAccountSection({ barbershopName, role, isTest }: DeleteAccountSectionProps) {
  const [impersonating, setImpersonating] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch("/api/admin/impersonate")
      .then((r) => r.json())
      .then((data) => setImpersonating(data.impersonating === true))
      .catch(() => setImpersonating(false))
  }, [])

  const canDelete =
    !!barbershopName &&
    !impersonating &&
    role !== "super_admin" &&
    !isTest

  if (!canDelete) return null

  return (
    <>
      <Card className="bg-card border-destructive/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Excluir conta
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Apaga permanentemente a barbearia <strong className="text-foreground">{barbershopName}</strong>,
            incluindo agenda, clientes, barbeiros, financeiro e assinatura. Esta ação não pode ser desfeita.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
            Excluir minha conta
          </Button>
        </CardContent>
      </Card>

      <DeleteAccountDialog
        open={open}
        onOpenChange={setOpen}
        barbershopName={barbershopName}
      />
    </>
  )
}
