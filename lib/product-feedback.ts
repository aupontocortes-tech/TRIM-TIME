export const FEEDBACK_CATEGORIES = [
  {
    id: "feature",
    label: "Nova funcionalidade",
    description: "Algo que ainda não existe e faria diferença no dia a dia.",
  },
  {
    id: "improvement",
    label: "Melhoria",
    description: "Algo que já existe, mas pode ficar melhor ou mais rápido.",
  },
  {
    id: "ux",
    label: "Experiência / layout",
    description: "Telas, fluxos, mobile, clareza ou usabilidade.",
  },
  {
    id: "bug",
    label: "Problema / bug",
    description: "Comportamento incorreto ou erro no sistema.",
  },
  {
    id: "integration",
    label: "Integração",
    description: "WhatsApp, pagamentos, Google, PWA ou outras conexões.",
  },
  {
    id: "other",
    label: "Outro",
    description: "Ideias gerais ou feedback que não se encaixa acima.",
  },
] as const

export const FEEDBACK_AREAS = [
  { id: "agenda", label: "Agenda e agendamentos" },
  { id: "clientes", label: "Clientes" },
  { id: "financeiro", label: "Financeiro" },
  { id: "equipe", label: "Equipe / barbeiros" },
  { id: "trim_play", label: "Trim Play" },
  { id: "notificacoes", label: "Notificações / WhatsApp" },
  { id: "assinatura", label: "Planos e assinatura" },
  { id: "geral", label: "Geral / plataforma" },
] as const

export const FEEDBACK_IMPACTS = [
  { id: "low", label: "Baixo — seria útil" },
  { id: "medium", label: "Médio — melhora a rotina" },
  { id: "high", label: "Alto — impacto direto no negócio" },
] as const

export const FEEDBACK_STATUSES = [
  { id: "new", label: "Novo", tone: "blue" as const },
  { id: "reviewing", label: "Em análise", tone: "amber" as const },
  { id: "planned", label: "Planejado", tone: "purple" as const },
  { id: "in_progress", label: "Em desenvolvimento", tone: "cyan" as const },
  { id: "shipped", label: "Implementado", tone: "green" as const },
  { id: "declined", label: "Não previsto", tone: "zinc" as const },
] as const

export type FeedbackCategoryId = (typeof FEEDBACK_CATEGORIES)[number]["id"]
export type FeedbackAreaId = (typeof FEEDBACK_AREAS)[number]["id"]
export type FeedbackImpactId = (typeof FEEDBACK_IMPACTS)[number]["id"]
export type FeedbackStatusId = (typeof FEEDBACK_STATUSES)[number]["id"]

const categorySet = new Set<string>(FEEDBACK_CATEGORIES.map((c) => c.id))
const areaSet = new Set<string>(FEEDBACK_AREAS.map((a) => a.id))
const impactSet = new Set<string>(FEEDBACK_IMPACTS.map((i) => i.id))
const statusSet = new Set<string>(FEEDBACK_STATUSES.map((s) => s.id))

export function isFeedbackCategory(v: string): v is FeedbackCategoryId {
  return categorySet.has(v)
}

export function isFeedbackArea(v: string): v is FeedbackAreaId {
  return areaSet.has(v)
}

export function isFeedbackImpact(v: string): v is FeedbackImpactId {
  return impactSet.has(v)
}

export function isFeedbackStatus(v: string): v is FeedbackStatusId {
  return statusSet.has(v)
}

export function feedbackCategoryLabel(id: string): string {
  return FEEDBACK_CATEGORIES.find((c) => c.id === id)?.label ?? id
}

export function feedbackAreaLabel(id: string | null | undefined): string {
  if (!id) return "—"
  return FEEDBACK_AREAS.find((a) => a.id === id)?.label ?? id
}

export function feedbackImpactLabel(id: string): string {
  return FEEDBACK_IMPACTS.find((i) => i.id === id)?.label ?? id
}

export function feedbackStatusLabel(id: string): string {
  return FEEDBACK_STATUSES.find((s) => s.id === id)?.label ?? id
}

export function feedbackStatusMeta(id: string) {
  return FEEDBACK_STATUSES.find((s) => s.id === id) ?? FEEDBACK_STATUSES[0]
}

export type ProductFeedbackDto = {
  id: string
  barbershop_id: string
  barbershop_name?: string
  barbershop_slug?: string
  category: FeedbackCategoryId
  area: FeedbackAreaId | null
  title: string
  description: string
  impact: FeedbackImpactId
  status: FeedbackStatusId
  admin_notes: string | null
  read_by_admin: boolean
  created_at: string
  updated_at: string
}

export function toProductFeedbackDto(
  row: {
    id: string
    barbershopId: string
    category: string
    area: string | null
    title: string
    description: string
    impact: string
    status: string
    adminNotes: string | null
    readByAdmin: boolean
    createdAt: Date
    updatedAt: Date
    barbershop?: { name: string; slug: string } | null
  }
): ProductFeedbackDto {
  return {
    id: row.id,
    barbershop_id: row.barbershopId,
    barbershop_name: row.barbershop?.name,
    barbershop_slug: row.barbershop?.slug,
    category: row.category as FeedbackCategoryId,
    area: row.area as FeedbackAreaId | null,
    title: row.title,
    description: row.description,
    impact: row.impact as FeedbackImpactId,
    status: row.status as FeedbackStatusId,
    admin_notes: row.adminNotes,
    read_by_admin: row.readByAdmin,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
