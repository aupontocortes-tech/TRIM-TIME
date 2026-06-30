import { NextResponse } from "next/server"
import { issueAccountDeleteConfirmToken } from "@/lib/account-delete-confirm"
import { assertCanDeleteAccountFromRequest } from "@/lib/account-delete-guard"
import { sendOtpCodeEmail } from "@/lib/otp-email-send"

export const dynamic = "force-dynamic"

/** Gera código de confirmação (tela + e-mail) para exclusão da conta logada. */
export async function POST() {
  try {
    const { barbershopId, email, name } = await assertCanDeleteAccountFromRequest()
    const issued = issueAccountDeleteConfirmToken(barbershopId)

    const mailed = await sendOtpCodeEmail({
      to: email,
      code: issued.code,
      subject: "Confirme a exclusão da sua conta Trim Time",
      intro: `Você solicitou excluir permanentemente a barbearia "${name}". Use o código abaixo na tela de confirmação. Válido por cerca de 10 minutos.`,
    })

    return NextResponse.json({
      code: issued.code,
      session: issued.session,
      expires_at: issued.expires_at,
      email: email.replace(/^(.{2}).*(@.*)$/, "$1***$2"),
      email_sent: mailed.ok,
      ...(mailed.ok ? {} : { email_error: mailed.error }),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar código"
    const status =
      message.includes("Não autorizado") || message.includes("impersonação")
        ? 403
        : message.includes("não pode") || message.includes("suspensa")
          ? 403
          : 500
    console.error("[delete-account/request]", e)
    return NextResponse.json({ error: message }, { status })
  }
}
