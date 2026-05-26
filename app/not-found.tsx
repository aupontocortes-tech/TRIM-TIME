import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/brand-logo"
import { TrimTimeWordmark } from "@/components/trim-time-wordmark"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-3 mb-8">
        <BrandLogo size="lg" priority={false} />
        <TrimTimeWordmark className="text-2xl" />
      </div>
      <p className="text-muted-foreground text-sm uppercase tracking-widest mb-2">404</p>
      <h1 className="text-2xl font-semibold text-foreground text-center mb-2">
        Página não encontrada
      </h1>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        O endereço pode estar incorreto ou a página foi movida.
      </p>
      <Button asChild className="bg-primary text-primary-foreground">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </div>
  )
}
