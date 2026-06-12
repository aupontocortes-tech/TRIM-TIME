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

/** Busca barbearia pelo e-mail digitado (inclui equivalência Gmail: pontos e +alias). */
export async function findBarbershopByLoginEmail(
  emailInput: string
): Promise<BarbershopLoginRow | null> {
  const emailNorm = normalizeSignupEmail(emailInput)
  const emailCanon = canonicalSignupEmail(emailNorm)
  const emails = emailNorm === emailCanon ? [emailNorm] : [emailNorm, emailCanon]

  return prisma.barbershop.findFirst({
    where: { email: { in: emails } },
    select: { id: true, role: true, settings: true, suspendedAt: true, email: true },
  })
}
