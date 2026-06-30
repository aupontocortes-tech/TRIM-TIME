import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getBarbershopPasswordHash } from "@/lib/barbershop-auth-settings"
import { getBarbershopIdFromRequest, IMPERSONATE_COOKIE } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function resolveDeleteAccountAccess(shop: {
  role: string
  isTest: boolean
  impersonating: boolean
}): { can_delete_account: boolean; delete_account_blocked_reason?: string } {
  if (shop.impersonating) {
    return {
      can_delete_account: false,
      delete_account_blocked_reason:
        "Você entrou pela Plataforma (impersonação). Volte à plataforma e faça login direto com o e-mail da barbearia para excluir a conta.",
    }
  }
  if (shop.role === "super_admin") {
    return {
      can_delete_account: false,
      delete_account_blocked_reason: "Conta Super Admin não pode ser excluída pelo painel.",
    }
  }
  if (shop.isTest) {
    return {
      can_delete_account: false,
      delete_account_blocked_reason: "Conta de teste interna — entre em contato com o suporte para remover.",
    }
  }
  return { can_delete_account: true }
}

/** Estado da senha da conta logada (barbearia / super admin). */
export async function GET() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const cookieStore = await cookies()
    const impersonating = !!cookieStore.get(IMPERSONATE_COOKIE)?.value

    const shop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { email: true, settings: true, role: true, isTest: true, suspendedAt: true, name: true },
    })
    if (!shop) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 })
    }
    if (shop.suspendedAt) {
      return NextResponse.json({ error: "Conta suspensa" }, { status: 403 })
    }

    const deleteAccess = resolveDeleteAccountAccess({
      role: shop.role,
      isTest: shop.isTest,
      impersonating,
    })

    return NextResponse.json({
      email: shop.email,
      barbershop_name: shop.name,
      has_password: !!getBarbershopPasswordHash(shop.settings),
      role: shop.role,
      is_test: shop.isTest,
      impersonating,
      ...deleteAccess,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar" },
      { status: 500 }
    )
  }
}
