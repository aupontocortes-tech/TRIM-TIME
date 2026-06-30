import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { canonicalSignupEmail, normalizeSignupEmail } from "@/lib/signup-identity"

export type BarbershopLoginRow = {
  id: string
  role: string
  settings: Prisma.JsonValue | null
  suspendedAt: Date | null
  email: string
}

/** Quando o mesmo e-mail tem várias barbearias, prioriza super_admin (ex.: ADM1). */
export function pickPreferredBarbershopForLogin<
  T extends { role: string; createdAt?: Date },
>(rows: T[]): T | null {
  if (rows.length === 0) return null
  const superAdmin = rows.find((r) => r.role === "super_admin")
  if (superAdmin) return superAdmin
  if (rows.some((r) => r.createdAt)) {
    return [...rows].sort(
      (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
    )[0]
  }
  return rows[0]
}

/** Busca barbearia pelo e-mail digitado (inclui equivalência Gmail: pontos e +alias). */
export async function findBarbershopByLoginEmail(
  emailInput: string
): Promise<BarbershopLoginRow | null> {
  const emailNorm = normalizeSignupEmail(emailInput)
  const emailCanon = canonicalSignupEmail(emailNorm)
  const emails = emailNorm === emailCanon ? [emailNorm] : [emailNorm, emailCanon]

  const rows = await prisma.barbershop.findMany({
    where: { email: { in: emails } },
    select: {
      id: true,
      role: true,
      settings: true,
      suspendedAt: true,
      email: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  return pickPreferredBarbershopForLogin(rows)
}
