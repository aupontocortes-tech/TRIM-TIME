/**
 * Fidelidade — estrutura de dados em `clients.loyalty_points` + `loyalty_ledger_entries`.
 * As APIs de gravação podem chamar estas funções quando o plano tiver `loyalty_program`.
 */
import type { SubscriptionPlan } from "@/lib/db/types"
import { hasFeature } from "@/lib/plans"

export function loyaltyProgramEnabled(plan: SubscriptionPlan | null): boolean {
  return !!(plan && hasFeature(plan, "loyalty_program"))
}

/** Exemplo: pontos por atendimento concluído (ajustar regra de negócio depois). */
export const DEFAULT_POINTS_PER_COMPLETED_VISIT = 1
