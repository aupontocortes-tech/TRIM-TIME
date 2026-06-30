import { createHmac, randomInt } from "crypto"

const DELETE_TOKEN_TTL_MS = 10 * 60 * 1000

function signingSecret(): string {
  const secret =
    process.env.ACCOUNT_DELETE_CONFIRM_TOKEN?.trim() ||
    process.env.ADMIN_REFUND_CONFIRM_TOKEN?.trim() ||
    process.env.ASAAS_WEBHOOK_TOKEN?.trim() ||
    process.env.ASAAS_API_KEY?.trim()
  if (!secret) {
    throw new Error(
      "Servidor sem chave para confirmação de exclusão. Configure ASAAS_API_KEY ou ASAAS_WEBHOOK_TOKEN na Vercel."
    )
  }
  return secret
}

function signDeletePayload(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url")
}

/** Gera código de 6 dígitos + sessão assinada (válido ~10 min, amarrado à barbearia). */
export function issueAccountDeleteConfirmToken(barbershopId: string) {
  const code = String(randomInt(100000, 999999))
  const exp = Date.now() + DELETE_TOKEN_TTL_MS
  const sig = signDeletePayload(`delete-account|${barbershopId}|${exp}|${code}`)
  return {
    code,
    session: `${exp}.${sig}`,
    expires_at: new Date(exp).toISOString(),
  }
}

export function assertAccountDeleteConfirmSession(
  barbershopId: string,
  code: string | undefined,
  session: string | undefined
): void {
  const got = code?.trim()
  if (!got || !session?.trim()) {
    throw new Error("Copie o código exibido acima e cole no campo de confirmação.")
  }
  const dot = session.indexOf(".")
  if (dot <= 0) {
    throw new Error("Sessão de confirmação inválida. Gere um novo código.")
  }
  const exp = Number(session.slice(0, dot))
  const sig = session.slice(dot + 1)
  if (!Number.isFinite(exp) || !sig) {
    throw new Error("Sessão de confirmação inválida. Gere um novo código.")
  }
  if (Date.now() > exp) {
    throw new Error("Código expirado. Gere um novo código e tente novamente.")
  }
  const expected = signDeletePayload(`delete-account|${barbershopId}|${exp}|${got}`)
  if (sig !== expected) {
    throw new Error("Código de confirmação incorreto.")
  }
}

export const ACCOUNT_DELETE_PHRASE = "EXCLUIR"
