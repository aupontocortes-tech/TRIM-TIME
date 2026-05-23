"use client"

import { FieldLabel } from "@/components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const MAPS_LINK_STEPS = [
  "Abra o Google Maps no celular ou no computador.",
  "Digite o endereço da sua barbearia e confira se o pino está no local certo.",
  "Toque em Compartilhar (ou nos três pontos do estabelecimento).",
  "Escolha Copiar link.",
  "Cole o link neste campo e salve as configurações.",
] as const

export function MapsLinkFieldLabel({
  htmlFor,
  optional,
}: {
  htmlFor?: string
  optional?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      <FieldLabel htmlFor={htmlFor} className="mb-0">
        Link do Google Maps
        {optional ? " (opcional)" : ""}
      </FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-5 min-w-5 px-0.5 items-center justify-center rounded-full border border-primary/60 text-primary text-xs font-bold leading-none hover:bg-primary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Como obter o link do Google Maps"
          >
            ?
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(calc(100vw-2rem),20rem)] bg-card border-border text-foreground p-3 shadow-lg"
        >
          <p className="text-sm font-semibold text-foreground mb-2">Como pegar o link</p>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4">
            {MAPS_LINK_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </PopoverContent>
      </Popover>
    </div>
  )
}
