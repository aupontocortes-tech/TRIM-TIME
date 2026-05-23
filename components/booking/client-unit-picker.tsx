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

function UnitLocationBlock({
  unit,
  className,
  onMapsClick,
}: {
  unit: UnitPickerAddressFields
  className?: string
  onMapsClick?: () => void
}) {
  const mapsUrl = normalizeGoogleMapsUrl(unit.maps_url)
  const addressLine = formatUnitAddressLine(unit)

  if (mapsUrl) {
    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.stopPropagation()
          onMapsClick?.()
        }}
        className={cn(
          "text-xs mt-1 flex gap-1 leading-snug text-primary font-medium hover:underline underline-offset-2",
          className
        )}
      >
        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
        <span>
          {addressLine !== "Endereço não informado" &&
          addressLine !== "Localização no Google Maps"
            ? `${addressLine} · `
            : ""}
          Ver rota no Google Maps
        </span>
      </a>
    )
  }

  return (
    <p className={cn("text-xs text-muted-foreground mt-1 flex gap-1 leading-snug", className)}>
      <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground/80" aria-hidden />
      <span>{addressLine}</span>
    </p>
  )
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
                <UnitLocationBlock unit={selectedUnit} />
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
          className="max-h-[min(92dvh,640px)] rounded-t-2xl px-0 pb-0 gap-0 border-t border-border [&>button]:hidden"
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
                      <UnitLocationBlock unit={unit} />
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
            <div className="px-4 pt-2 border-t border-border bg-background/95">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide mb-1.5">
                Selecionada
              </p>
              <div
                className={cn(
                  "rounded-xl border-2 p-3 mb-3",
                  unitPickerAccent(
                    Math.max(
                      0,
                      units.findIndex((u) => u.id === draftUnit.id)
                    )
                  ).border,
                  "bg-card"
                )}
              >
                <p className="font-semibold text-sm text-foreground">{draftUnit.name}</p>
                <UnitLocationBlock unit={draftUnit} />
              </div>
            </div>
          ) : null}

          <SheetFooter className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-0 border-t-0">
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
