import { prisma } from "@/lib/prisma"
import { clientPhoneDigits, clientPhonesMatch } from "@/lib/client-phone-utils"

export {
  clientPhoneDigits,
  clientPhonesMatch,
  normalizeClienteNomeParaComparar,
} from "@/lib/client-phone-utils"

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
