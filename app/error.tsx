"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">Algo deu errado</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        Não foi possível carregar esta página. Você pode tentar de novo ou voltar ao início.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        <Button type="button" onClick={() => reset()}>
          Tentar novamente
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Ir para o início</Link>
        </Button>
      </div>
    </div>
  )
}
