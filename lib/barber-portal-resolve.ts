import { prisma } from "@/lib/prisma"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidPortalToken(t: string) {
  return UUID_RE.test(String(t ?? "").trim())
}

export async function findBarberByPortalToken(portalToken: string) {
  const pt = String(portalToken ?? "").trim()
  if (!isValidPortalToken(pt)) return null
  return prisma.barber.findFirst({
    where: { portalToken: pt, active: true },
    select: {
      id: true,
      barbershopId: true,
      name: true,
      email: true,
      phone: true,
      passwordHash: true,
      authUserId: true,
      commission: true,
      barbershop: { select: { name: true, slug: true, suspendedAt: true } },
    },
  })
}
