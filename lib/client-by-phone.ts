import { prisma } from "@/lib/prisma"

/** Apenas dígitos (reconhecimento do cliente por telefone). */
export function clientPhoneDigits(phone: string | null | undefined): string {
  return String(phone ?? "").replace(/\D/g, "")
}

/**
 * Mesmo critério do link público: igualdade por dígitos ou pelos últimos 11 (DDD+número BR).
 */
export function clientPhonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = clientPhoneDigits(a)
  const db = clientPhoneDigits(b)
  if (da.length < 10 || db.length < 10) return false
  if (da === db) return true
  const na = da.length >= 11 ? da.slice(-11) : da
  const nb = db.length >= 11 ? db.slice(-11) : db
  return na.length >= 10 && nb.length >= 10 && na === nb
}

export type ClientRowForPhoneMatch = {
  id: string
  name: string
  email: string | null
  phone: string | null
  photoUrl: string | null
  cpf: string | null
  notes: string | null
}

/**
 * Primeiro cliente da barbearia cujo telefone coincide com `phoneRaw` (normalizado por dígitos).
 * Carrega a lista da unidade — suficiente para barbearias típicas; evita match exato errado no Prisma.
 */
export async function findClientByPhoneDigits(
  barbershopId: string,
  phoneRaw: string
): Promise<ClientRowForPhoneMatch | null> {
  const digits = clientPhoneDigits(phoneRaw)
  if (digits.length < 10) return null
  const clients = await prisma.client.findMany({
    where: { barbershopId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      photoUrl: true,
      cpf: true,
      notes: true,
    },
  })
  return clients.find((c) => clientPhonesMatch(c.phone, phoneRaw)) ?? null
}
