import { prisma } from "@/lib/prisma"
import { getActiveBarbershopBySlug, toPublicClientSession } from "@/lib/public-booking"
import { clientPhoneDigits, findClientByPhoneDigits } from "@/lib/client-by-phone"
import type { Prisma } from "@prisma/client"

const clientSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  photoUrl: true,
  cpf: true,
  notes: true,
} satisfies Prisma.ClientSelect

export type ClientOAuthCompleteMode = "login" | "register"

export type ClientOAuthCompleteInput = {
  barbershopId: string
  email: string
  mode: ClientOAuthCompleteMode
  nome?: string
  telefone?: string
}

export type ClientOAuthCompleteSuccess = {
  ok: true
  client: ReturnType<typeof toPublicClientSession>
}

export type ClientOAuthCompleteFailure = {
  ok: false
  error: string
  code:
    | "not_registered"
    | "incomplete_register"
    | "invalid_phone"
    | "phone_conflict"
    | "not_found"
}

export type ClientOAuthCompleteResult = ClientOAuthCompleteSuccess | ClientOAuthCompleteFailure

function asStr(v: unknown) {
  return typeof v === "string" ? v.trim() : ""
}

export async function completeClientOAuthForBarbershop(
  input: ClientOAuthCompleteInput
): Promise<ClientOAuthCompleteResult> {
  const email = input.email.trim().toLowerCase()
  const nome = asStr(input.nome)
  const telefone = asStr(input.telefone)

  let client = await prisma.client.findFirst({
    where: { barbershopId: input.barbershopId, email },
    select: clientSelect,
  })

  if (!client && input.mode === "login") {
    return {
      ok: false,
      code: "not_registered",
      error: "Este e-mail ainda não está cadastrado nesta barbearia. Use «Cadastre-se».",
    }
  }

  if (input.mode === "register") {
    if (!nome || !telefone) {
      return {
        ok: false,
        code: "incomplete_register",
        error: "Informe nome e WhatsApp para concluir o cadastro com Google.",
      }
    }
    const digits = clientPhoneDigits(telefone)
    if (digits.length < 10) {
      return { ok: false, code: "invalid_phone", error: "Telefone inválido no cadastro." }
    }

    const byPhone = await findClientByPhoneDigits(input.barbershopId, telefone)
    if (byPhone && byPhone.email && byPhone.email.trim().toLowerCase() !== email) {
      return {
        ok: false,
        code: "phone_conflict",
        error: "Este telefone já está vinculado a outro e-mail.",
      }
    }

    if (client) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: { name: nome, phone: telefone, email },
        select: clientSelect,
      })
    } else if (byPhone) {
      client = await prisma.client.update({
        where: { id: byPhone.id },
        data: { name: nome, phone: telefone, email },
        select: clientSelect,
      })
    } else {
      client = await prisma.client.create({
        data: {
          barbershopId: input.barbershopId,
          name: nome,
          email,
          phone: telefone,
        },
        select: clientSelect,
      })
    }
  }

  if (!client) {
    return { ok: false, code: "not_found", error: "Cliente não encontrado." }
  }

  return { ok: true, client: toPublicClientSession(client) }
}

export async function completeClientOAuthBySlug(
  slug: string,
  input: Omit<ClientOAuthCompleteInput, "barbershopId">
): Promise<ClientOAuthCompleteResult | { ok: false; code: "shop_not_found"; error: string }> {
  const shop = await getActiveBarbershopBySlug(slug)
  if (!shop || shop.suspendedAt) {
    return { ok: false, code: "shop_not_found", error: "Barbearia não encontrada" }
  }
  return completeClientOAuthForBarbershop({
    barbershopId: shop.id,
    ...input,
  })
}
