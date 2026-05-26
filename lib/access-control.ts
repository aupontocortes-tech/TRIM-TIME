/**
 * Controle de acesso / limites — reexporta planos e helpers de tenant.
 * Use nas API routes para manter checagens consistentes.
 */
export {
  hasFeature,
  canAddBarber,
  canUseBarberCommission,
  getBarberLimit,
  getBarberLimitMessage,
  getUpgradeMessage,
  BARBER_LIMITS,
} from "@/lib/plans"

export type TenantBarbershopRole = "super_admin" | "admin_barbershop"

export function isPlatformSuperAdmin(role: string | null | undefined): boolean {
  return role === "super_admin"
}
