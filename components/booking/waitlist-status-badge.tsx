"use client"

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  waiting: {
    label: "Aguardando",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  notified: {
    label: "Vaga disponível",
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  accepted: {
    label: "Aceito",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  expired: {
    label: "Expirado",
    className: "bg-muted text-muted-foreground border-border",
  },
  canceled: {
    label: "Cancelado",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
}

export function WaitlistStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
}
