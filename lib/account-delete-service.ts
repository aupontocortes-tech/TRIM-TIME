import {
  archiveAsaasCustomerReference,
  cancelAsaasSubscription,
  cancelPixAutomaticAuthorization,
} from "@/lib/asaas/client"
import { isAsaasConfigured } from "@/lib/asaas/config"
import { prisma } from "@/lib/prisma"

export type DeleteBarbershopAccountResult = {
  barbershopName: string
  warnings: string[]
}

/** Cancela cobrança no Asaas (se houver) e apaga a barbearia (cascade no banco). */
export async function deleteBarbershopAccount(barbershopId: string): Promise<DeleteBarbershopAccountResult> {
  const warnings: string[] = []

  const shop = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { id: true, name: true, role: true, isTest: true },
  })
  if (!shop) {
    throw new Error("Conta não encontrada.")
  }
  if (shop.role === "super_admin" || shop.isTest) {
    throw new Error("Esta conta não pode ser excluída.")
  }

  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })

  if (sub && (await isAsaasConfigured())) {
    if (sub.asaasPixAutomaticAuthId) {
      try {
        await cancelPixAutomaticAuthorization(sub.asaasPixAutomaticAuthId)
      } catch (e) {
        warnings.push(
          `Pix Automático não cancelado no Asaas: ${e instanceof Error ? e.message : "erro"}`
        )
      }
    }
    if (sub.asaasSubscriptionId) {
      try {
        await cancelAsaasSubscription(sub.asaasSubscriptionId)
      } catch (e) {
        warnings.push(
          `Assinatura não cancelada no Asaas: ${e instanceof Error ? e.message : "erro"}`
        )
      }
    }
    if (sub.asaasCustomerId) {
      try {
        await archiveAsaasCustomerReference(sub.asaasCustomerId, barbershopId)
      } catch (e) {
        warnings.push(
          `Cliente Asaas não desvinculado: ${e instanceof Error ? e.message : "erro"}`
        )
      }
    }
  } else if (sub?.asaasSubscriptionId || sub?.asaasCustomerId) {
    warnings.push(
      "Asaas não configurado no servidor — a conta será apagada só no banco. Verifique cobranças pendentes no painel Asaas."
    )
  }

  await prisma.barbershop.delete({ where: { id: barbershopId } })

  return { barbershopName: shop.name, warnings }
}
