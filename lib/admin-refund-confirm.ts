/** Código que o super admin digita para confirmar estorno (Vercel: ADMIN_REFUND_CONFIRM_TOKEN). */
export function assertRefundConfirmToken(provided: string | undefined): void {
  const expected = process.env.ADMIN_REFUND_CONFIRM_TOKEN?.trim()
  if (!expected) {
    throw new Error(
      "Estorno bloqueado: configure ADMIN_REFUND_CONFIRM_TOKEN na Vercel (mesmo código que você digita no Financeiro)."
    )
  }
  const got = provided?.trim()
  if (!got || got !== expected) {
    throw new Error("Código de confirmação incorreto.")
  }
}
