import { feedbackStatusMeta } from "@/lib/product-feedback"
import { cn } from "@/lib/utils"

const TONE_CLASS: Record<string, string> = {
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  purple: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  zinc: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
}

const TONE_CLASS_LIGHT: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25",
  amber: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25",
  purple: "bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-500/25",
  cyan: "bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-500/25",
  green: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/25",
  zinc: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/25",
}

export function FeedbackStatusBadge({
  status,
  variant = "default",
  className,
}: {
  status: string
  variant?: "default" | "platform"
  className?: string
}) {
  const meta = feedbackStatusMeta(status)
  const toneClass = variant === "platform" ? TONE_CLASS[meta.tone] : TONE_CLASS_LIGHT[meta.tone]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        toneClass,
        className
      )}
    >
      {meta.label}
    </span>
  )
}
