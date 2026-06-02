"use client"

import { Minus, Plus, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  barberPhotoImageStyle,
  clampPhotoPosition,
  clampPhotoScale,
  PHOTO_POSITION_STEP,
  PHOTO_SCALE_MAX,
  PHOTO_SCALE_MIN,
  PHOTO_SCALE_STEP,
} from "@/lib/barber-photo-style"

type BarberPhotoAdjustProps = {
  photoUrl: string
  position: number
  scale: number
  onPositionChange: (value: number) => void
  onScaleChange: (value: number) => void
  previewSize?: "sm" | "md"
}

export function BarberPhotoAdjust({
  photoUrl,
  position,
  scale,
  onPositionChange,
  onScaleChange,
  previewSize = "md",
}: BarberPhotoAdjustProps) {
  const sizeClass = previewSize === "sm" ? "w-24 h-24" : "w-28 h-28"

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div
        className={`${sizeClass} rounded-full overflow-hidden border-2 border-primary/30 shrink-0 bg-secondary`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt=""
          className="w-full h-full object-cover"
          style={barberPhotoImageStyle(position, scale)}
        />
      </div>

      <div className="w-full space-y-2">
        <p className="text-xs text-muted-foreground text-center font-medium">Ajustar foto</p>
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 border-border"
            disabled={scale <= PHOTO_SCALE_MIN}
            onClick={() => onScaleChange(clampPhotoScale(scale - PHOTO_SCALE_STEP))}
          >
            <Minus className="w-3.5 h-3.5" />
            Diminuir
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">{scale}%</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 border-border"
            disabled={scale >= PHOTO_SCALE_MAX}
            onClick={() => onScaleChange(clampPhotoScale(scale + PHOTO_SCALE_STEP))}
          >
            <Plus className="w-3.5 h-3.5" />
            Aumentar
          </Button>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            disabled={position <= 0}
            onClick={() => onPositionChange(clampPhotoPosition(position - PHOTO_POSITION_STEP))}
          >
            <ChevronUp className="w-4 h-4" />
            Subir
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            disabled={position >= 100}
            onClick={() => onPositionChange(clampPhotoPosition(position + PHOTO_POSITION_STEP))}
          >
            <ChevronDown className="w-4 h-4" />
            Descer
          </Button>
        </div>
      </div>
    </div>
  )
}
