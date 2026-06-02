import type { CSSProperties } from "react"

export const PHOTO_SCALE_MIN = 75
export const PHOTO_SCALE_MAX = 125
export const PHOTO_SCALE_STEP = 5
export const PHOTO_POSITION_STEP = 5

export function clampPhotoScale(value: number): number {
  return Math.min(PHOTO_SCALE_MAX, Math.max(PHOTO_SCALE_MIN, Math.round(value)))
}

export function clampPhotoPosition(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

/** Estilo para foto circular (Avatar ou preview): posição vertical + zoom. */
export function barberPhotoImageStyle(
  position = 50,
  scale = 100
): CSSProperties {
  return {
    objectPosition: `center ${clampPhotoPosition(position)}%`,
    transform: `scale(${clampPhotoScale(scale) / 100})`,
    transformOrigin: "center center",
  }
}
