import { cn } from "@/lib/utils"

/** Texto da marca com tipografia profissional (Cormorant Garamond). */
export function TrimTimeWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-trim-time-wordmark text-primary", className)}>
      Trim Time
    </span>
  )
}
