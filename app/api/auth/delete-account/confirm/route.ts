import { NextResponse } from "next/server"
import {
  ACCOUNT_DELETE_PHRASE,
  assertAccountDeleteConfirmSession,
} from "@/lib/account-delete-confirm"
import { assertCanDeleteAccountFromRequest } from "@/lib/account-delete-guard"
import { deleteBarbershopAccount } from "@/lib/account-delete-service"
import { clearPainelSessionCookies } from "@/lib/tenant"

export const dynamic = "force-dynamic"

type ConfirmBody = {
  code?: string
  session?: string
  phrase?: string
  acknowledged?: boolean
}

/** Exclui permanentemente a barbearia da sessão após confirmação por código. */
export async function POST(request: Request) {
  try {
    const { barbershopId } = await assertCanDeleteAccountFromRequest()
    const body = (await request.json()) as ConfirmBody

    assertAccountDeleteConfirmSession(barbershopId, body.code, body.session)

    if (body.phrase?.trim().toUpperCase() !== ACCOUNT_DELETE_PHRASE) {
      return NextResponse.json(
        { error: `Digite ${ACCOUNT_DELETE_PHRASE} para confirmar.` },
        { status: 400 }
      )
    }
    if (body.acknowledged !== true) {
      return NextResponse.json(
        { error: "Marque que entende que a exclusão é permanente." },
        { status: 400 }
      )
    }

    const result = await deleteBarbershopAccount(barbershopId)
    await clearPainelSessionCookies()

    return NextResponse.json({
      ok: true,
      message: `Conta "${result.barbershopName}" excluída permanentemente.`,
      warnings: result.warnings,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao excluir conta"
    const status =
      message.includes("Código") ||
      message.includes("Sessão") ||
      message.includes("expirado") ||
      message.includes("incorreto")
        ? 400
        : message.includes("Não autorizado") ||
            message.includes("impersonação") ||
            message.includes("não pode") ||
            message.includes("suspensa")
          ? 403
          : 500
    console.error("[delete-account/confirm]", e)
    return NextResponse.json({ error: message }, { status })
  }
}
