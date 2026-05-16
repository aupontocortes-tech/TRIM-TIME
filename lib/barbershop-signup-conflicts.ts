import { prisma } from "@/lib/prisma"
import {
  canonicalSignupEmail,
  emailsEquivalentForSignup,
  normalizeSignupEmail,
  phoneNationalKeyBrazil,
} from "@/lib/signup-identity"

type Db = Pick<typeof prisma, "barbershop">

export async function checkBarbershopSignupEmailTaken(
  db: Db,
  candidateRaw: string
): Promise<boolean> {
  const candidate = canonicalSignupEmail(normalizeSignupEmail(candidateRaw))
  const rows = await db.barbershop.findMany({
    select: { email: true },
  })
  return rows.some((r) =>
    emailsEquivalentForSignup(candidate, normalizeSignupEmail(r.email))
  )
}

export async function checkBarbershopSignupPhoneTaken(
  db: Db,
  candidatePhoneRaw: string | null | undefined
): Promise<boolean> {
  const key = candidatePhoneRaw ? phoneNationalKeyBrazil(candidatePhoneRaw) : null
  if (!key) return false

  const rows = await db.barbershop.findMany({
    where: { phone: { not: null } },
    select: { phone: true },
  })
  for (const r of rows) {
    const pk = phoneNationalKeyBrazil(String(r.phone ?? ""))
    if (pk && pk === key) return true
  }
  return false
}

export async function conflictForBarbershopSignup(
  db: Db,
  input: { email: string; phone?: string | null }
): Promise<"email" | "phone" | null> {
  if (await checkBarbershopSignupEmailTaken(db, input.email)) return "email"
  if (input.phone && (await checkBarbershopSignupPhoneTaken(db, input.phone))) return "phone"
  return null
}
