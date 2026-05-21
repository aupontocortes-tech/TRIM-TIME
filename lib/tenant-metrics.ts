/** Barbearias reais para métricas de negócio (exclui super_admin e contas de teste). */
export const REAL_BARBERSHOP_WHERE = {
  NOT: { role: "super_admin" as const },
  isTest: false,
} as const

export const REAL_SUBSCRIPTION_WHERE = {
  barbershop: REAL_BARBERSHOP_WHERE,
} as const
