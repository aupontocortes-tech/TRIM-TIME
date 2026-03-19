import Image from "next/image"
import { cn } from "@/lib/utils"

/** Logo oficial Trim Time (PNG); otimizado pelo Next (AVIF/WebP) para melhor nitidez. */
const LOGO_SRC = "/logo-trim-time.png"

const sizeClass: Record<"sm" | "md" | "lg" | "xl" | "hero", string> = {
  sm: "h-9 w-9 min-h-9 min-w-9",
  md: "h-11 w-11 min-h-11 min-w-11",
  lg: "h-12 w-12 min-h-12 min-w-12",
  xl: "h-16 w-16 min-h-16 min-w-16",
  /** Landing / destaque — quadrado grande na tela */
  hero: "h-20 w-20 min-h-20 min-w-20 sm:h-24 sm:w-24 sm:min-h-24 sm:min-w-24 md:h-[7rem] md:w-[7rem] md:min-h-[7rem] md:min-w-[7rem]",
}

function sizesAttr(size: keyof typeof sizeClass): string {
  switch (size) {
    case "hero":
      return "(max-width: 640px) 80px, (max-width: 768px) 96px, 128px"
    case "xl":
      return "64px"
    case "lg":
      return "48px"
    case "md":
      return "44px"
    case "sm":
    default:
      return "36px"
  }
}

type BrandLogoProps = {
  size?: keyof typeof sizeClass
  className?: string
  /** Borda dourada sutil (ex.: painel) */
  withBorder?: boolean
  /** Prioridade de carregamento (LCP) — use no topo da página */
  priority?: boolean
}

export function BrandLogo({
  size = "md",
  className,
  withBorder = true,
  priority,
}: BrandLogoProps) {
  const isPriority = priority ?? size === "hero"

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg bg-black",
        withBorder && "border border-primary/40 shadow-[0_0_14px_rgba(201,162,39,0.22)]",
        sizeClass[size],
        className
      )}
    >
      <Image
        src={LOGO_SRC}
        alt="Trim Time"
        fill
        sizes={sizesAttr(size)}
        quality={100}
        priority={isPriority}
        className="object-contain p-0.5 [image-rendering:auto]"
        draggable={false}
      />
    </div>
  )
}
