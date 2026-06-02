"use client"

import {
  barberPhotoImageStyle,
  clampPhotoPosition,
  clampPhotoScale,
  PHOTO_SCALE_MAX,
  PHOTO_SCALE_MIN,
} from "@/lib/barber-photo-style"

type BarberPhotoAdjustProps = {
  photoUrl: string
  position: number
  scale: number
  onPositionChange: (value: number) => void
  onScaleChange: (value: number) => void
  previewSize?: "sm" | "md" | "lg"
}

export function BarberPhotoAdjust({
  photoUrl,
  position,
  scale,
  onPositionChange,
  onScaleChange,
  previewSize = "md",
}: BarberPhotoAdjustProps) {
  const sizeClass =
    previewSize === "lg" ? "w-32 h-32" : previewSize === "sm" ? "w-24 h-24" : "w-28 h-28"

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

      <div className="w-full space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tamanho da foto</span>
            <span className="tabular-nums">{scale}%</span>
          </div>
          <input
            type="range"
            min={PHOTO_SCALE_MIN}
            max={PHOTO_SCALE_MAX}
            step={5}
            value={scale}
            onChange={(e) => onScaleChange(clampPhotoScale(Number(e.target.value)))}
            className="w-full accent-primary cursor-pointer"
            aria-label="Tamanho da foto"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Diminuir</span>
            <span>Aumentar</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Posição (subir / descer)</p>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={position}
            onChange={(e) => onPositionChange(clampPhotoPosition(Number(e.target.value)))}
            className="w-full accent-primary cursor-pointer"
            aria-label="Posição vertical da foto"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Topo</span>
            <span>Base</span>
          </div>
        </div>
      </div>
    </div>
  )
}
