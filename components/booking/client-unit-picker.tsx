"use client"

import { useEffect, useState } from "react"
import { Building2, Check, ChevronRight, Info, MapPin, Store, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  formatUnitAddressLine,
  unitPickerAccent,
  type UnitPickerAddressFields,
} from "@/lib/unit-picker-accent"
import { normalizeGoogleMapsUrl } from "@/lib/google-maps-url"
import { cn } from "@/lib/utils"

function UnitAddressLine({
  unit,
  className,
  variant = "default",
}: {
  unit: UnitPickerAddressFields
  className?: string
  /** Rodapé “Selecionada”: texto maior e contraste alto no fundo escuro. */
  variant?: "default" | "prominent"
}) {
  const prominent = variant === "prominent"
  return (
    <p
      className={cn(
        "flex gap-2 mt-1.5",
        prominent
          ? "text-sm text-foreground/90 leading-relaxed"
          : "text-xs text-muted-foreground leading-snug gap-1",
        className
      )}
    >
      <MapPin
        className={cn(
          "shrink-0 mt-0.5",
          prominent ? "w-4 h-4 text-primary" : "w-3.5 h-3.5 text-muted-foreground/80"
        )}
        aria-hidden
      />
      <span className={prominent ? "break-words" : undefined}>
        {formatUnitAddressLine(unit)}
      </span>
    </p>
  )
}

/** Card “Selecionada”: mostra endereço; toque abre o Google Maps quando houver link. */
function SelectedUnitCard({
  unit,
  borderClass,
}: {
  unit: ClientUnitPickerUnit
  borderClass: string
}) {
  const mapsUrl = normalizeGoogleMapsUrl(unit.maps_url)
  const className = cn(
    "rounded-xl border-2 p-4 w-full text-left transition-colors",
    borderClass,
    "bg-muted/80 shadow-sm",
    mapsUrl && "hover:bg-muted active:scale-[0.99] cursor-pointer"
  )

  const body = (
    <>
      <p className="font-bold text-base text-foreground leading-tight">{unit.name}</p>
      <UnitAddressLine unit={unit} variant="prominent" />
      {mapsUrl ? (
        <p className="text-xs text-primary font-semibold mt-3">
          Toque para abrir no Google Maps
        </p>
      ) : null}
    </>
  )

  if (mapsUrl) {
    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={`Abrir localização de ${unit.name} no Google Maps`}
        onClick={(e) => e.stopPropagation()}
      >
        {body}
      </a>
    )
  }

  return <div className={className}>{body}</div>
}

export type ClientUnitPickerUnit = {
  id: string
  name: string
} & UnitPickerAddressFields

type ClientUnitPickerProps = {
  units: ClientUnitPickerUnit[]
  selectedUnitId: string | null
  onConfirm: (unitId: string) => void
  /** Texto curto de funcionamento (mesma barbearia; opcional no card). */
  hoursHint?: string | null
}

export function ClientUnitPicker({
  units,
  selectedUnitId,
  onConfirm,
  hoursHint,
}: ClientUnitPickerProps) {
  const [open, setOpen] = useState(false)
  const [draftId, setDraftId] = useState<string | null>(selectedUnitId)

  useEffect(() => {
    if (!open) setDraftId(selectedUnitId)
  }, [open, selectedUnitId])

  const selectedUnit = units.find((u) => u.id === selectedUnitId) ?? null
  const draftUnit = units.find((u) => u.id === draftId) ?? null
  const needsPick = units.length > 1 && !selectedUnitId

  const openSheet = () => {
    setDraftId(selectedUnitId ?? units[0]?.id ?? null)
    setOpen(true)
  }

  const confirm = () => {
    if (!draftId) return
    onConfirm(draftId)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={cn(
          "w-full text-left rounded-xl border-2 p-4 transition-colors active:scale-[0.99]",
          needsPick
            ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_rgba(var(--primary),0.15)]"
            : selectedUnit
              ? "border-primary/35 bg-card/90"
              : "border-border bg-card/80 hover:border-primary/30"
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center shrink-0",
              selectedUnit
                ? unitPickerAccent(units.findIndex((u) => u.id === selectedUnit.id)).circle
                : "bg-primary/20"
            )}
          >
            <Building2
              className={cn(
                "w-5 h-5",
                selectedUnit ? "text-white" : "text-primary"
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-foreground tracking-tight">
              Escolha a unidade
            </p>
            {selectedUnit ? (
              <>
                <p className="text-sm font-semibold text-foreground mt-1 truncate">
                  {selectedUnit.name}
                </p>
                <UnitAddressLine unit={selectedUnit} />
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Toque para ver endereços e escolher onde será o atendimento
              </p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-primary shrink-0 mt-1" aria-hidden />
        </div>
        {needsPick ? (
          <p className="text-xs text-primary font-medium mt-3 pl-14">
            Selecione uma unidade para continuar o agendamento
          </p>
        ) : null}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[min(92dvh,640px)] rounded-t-2xl px-0 pb-0 gap-0 border-t border-border flex flex-col [&>button]:hidden"
        >
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" aria-hidden />
          </div>

          <SheetHeader className="px-4 pb-2 text-left space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle className="text-lg font-bold">Escolha a unidade</SheetTitle>
                <SheetDescription className="text-sm">
                  Selecione onde deseja realizar seu atendimento
                </SheetDescription>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-3 space-y-2.5 min-h-0">
            {units.map((unit, index) => {
              const accent = unitPickerAccent(index)
              const isSelected = draftId === unit.id
              return (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => setDraftId(unit.id)}
                  className={cn(
                    "w-full text-left rounded-xl border p-3.5 transition-all",
                    isSelected
                      ? cn("border-2 bg-card", accent.border, accent.ring, "ring-2")
                      : "border-border bg-card/60 hover:border-muted-foreground/40"
                  )}
                >
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center shrink-0",
                        accent.circle
                      )}
                    >
                      <Store className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground text-sm leading-tight">
                        {unit.name}
                      </p>
                      <UnitAddressLine unit={unit} />
                      {hoursHint ? (
                        <p className={cn("text-[11px] mt-1.5 font-medium", accent.badge)}>
                          {hoursHint}
                        </p>
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center mt-0.5 transition-colors",
                        isSelected
                          ? cn("border-transparent", accent.check)
                          : "border-muted-foreground/40"
                      )}
                      aria-hidden
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : null}
                    </div>
                  </div>
                </button>
              )
            })}

            <div className="flex gap-2 rounded-lg bg-muted/40 border border-border/60 px-3 py-2.5 text-[11px] text-muted-foreground leading-snug">
              <Info className="w-4 h-4 shrink-0 text-primary/80 mt-0.5" />
              <span>
                Os horários disponíveis podem variar conforme a unidade selecionada.
              </span>
            </div>
          </div>

          {draftUnit ? (
            <div className="shrink-0 px-4 pt-3 pb-2 border-t border-border bg-background shadow-[0_-6px_20px_rgba(0,0,0,0.35)]">
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                Selecionada
              </p>
              <SelectedUnitCard
                unit={draftUnit}
                borderClass={
                  unitPickerAccent(
                    Math.max(0, units.findIndex((u) => u.id === draftUnit.id))
                  ).border
                }
              />
            </div>
          ) : null}

          <SheetFooter className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 border-t border-border/60 bg-background">
            <Button
              type="button"
              className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!draftId}
              onClick={confirm}
            >
              Confirmar unidade
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
