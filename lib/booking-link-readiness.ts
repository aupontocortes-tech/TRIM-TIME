export type BookingLinkItem = { active?: boolean }

export type BookingLinkReadiness = {
  ready: boolean
  missingServices: boolean
  missingBarbers: boolean
}

export function getBookingLinkReadiness(
  services: BookingLinkItem[],
  barbers: BookingLinkItem[]
): BookingLinkReadiness {
  const hasActiveService = services.some((s) => s.active !== false)
  const hasActiveBarber = barbers.some((b) => b.active !== false)
  return {
    ready: hasActiveService && hasActiveBarber,
    missingServices: !hasActiveService,
    missingBarbers: !hasActiveBarber,
  }
}

export function bookingLinkReadinessMessage(readiness: BookingLinkReadiness): string {
  if (readiness.ready) return ""

  if (readiness.missingServices && readiness.missingBarbers) {
    return "Antes de enviar o link ao cliente, cadastre pelo menos um serviço (aba Serviços) e um barbeiro (aba Equipe)."
  }
  if (readiness.missingServices) {
    return "Antes de enviar o link ao cliente, cadastre pelo menos um serviço na aba Serviços."
  }
  return "Antes de enviar o link ao cliente, cadastre pelo menos um barbeiro na aba Equipe."
}
