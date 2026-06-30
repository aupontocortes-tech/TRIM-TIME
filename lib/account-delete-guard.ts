import { cookies } from "next/headers"
import { getRealBarbershopIdFromRequest, IMPERSONATE_COOKIE } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

export type DeleteAccountContext = {
  barbershopId: string
  email: string
  name: string
}

/** Valida sessão real (sem impersonação) e bloqueia contas protegidas. */
export async function assertCanDeleteAccountFromRequest(): Promise<DeleteAccountContext> {
  const cookieStore = await cookies()
  if (cookieStore.get(IMPERSONATE_COOKIE)?.value) {
    throw new Error("Saia da impersonação antes de excluir uma conta.")
  }

  const barbershopId = await getRealBarbershopIdFromRequest()
  if (!barbershopId) {
    throw new Error("Não autorizado.")
  }

  const shop = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { id: true, name: true, email: true, role: true, isTest: true, suspendedAt: true },
  })
  if (!shop) {
    throw new Error("Conta não encontrada.")
  }
  if (shop.suspendedAt) {
    throw new Error("Conta suspensa. Entre em contato com o suporte.")
  }
  if (shop.role === "super_admin" || shop.isTest) {
    throw new Error("Esta conta não pode ser excluída pelo painel.")
  }

  return { barbershopId: shop.id, email: shop.email, name: shop.name }
}
