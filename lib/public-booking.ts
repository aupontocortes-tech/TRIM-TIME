import { prisma } from "@/lib/prisma"
import { parseClientNotes } from "@/lib/client-auth-notes"

export type PublicClientSession = {
  id: string
  nome: string
  email: string
  telefone: string
}

export async function getActiveBarbershopBySlug(slug: string) {
  return prisma.barbershop.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      suspendedAt: true,
    },
  })
}

export function toPublicClientSession(client: {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes?: string | null
}): PublicClientSession {
  return {
    id: client.id,
    nome: client.name,
    email: client.email ?? "",
    telefone: client.phone ?? "",
  }
}

export function getClientPasswordHash(notes: string | null | undefined) {
  return parseClientNotes(notes).auth.passwordHash ?? null
}
