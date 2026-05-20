import { NextResponse } from "next/server"
import {
  getTrialCardSetupPrefill,
  isBillingEnabled,
  registerTrialCardInApp,
} from "@/lib/asaas/billing-service"
import { getAsaasEnvironment } from "@/lib/asaas/config"
import type { TrialCardSetupPayload } from "@/lib/asaas/card-types"
import { getClientIpFromRequest } from "@/lib/request-client-ip"
import { getBarbershopIdFromRequest } from "@/lib/tenant"

function parseCardBody(body: unknown): TrialCardSetupPayload | string {
  if (!body || typeof body !== "object") return "Dados do cartão inválidos."
  const b = body as Record<string, unknown>
  const cc = b.creditCard as Record<string, unknown> | undefined
  const hi = b.creditCardHolderInfo as Record<string, unknown> | undefined
  if (!cc || !hi) return "Informe os dados do cartão e do titular."

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const creditCard = {
    holderName: str(cc.holderName),
    number: str(cc.number),
    expiryMonth: str(cc.expiryMonth),
    expiryYear: str(cc.expiryYear),
    ccv: str(cc.ccv),
  }
  const creditCardHolderInfo = {
    name: str(hi.name),
    email: str(hi.email),
    cpfCnpj: str(hi.cpfCnpj),
    postalCode: str(hi.postalCode),
    addressNumber: str(hi.addressNumber),
    addressComplement: str(hi.addressComplement) || undefined,
    phone: str(hi.phone),
    mobilePhone: str(hi.mobilePhone) || undefined,
  }

  if (!creditCard.holderName || !creditCard.number || !creditCard.expiryMonth || !creditCard.expiryYear || !creditCard.ccv) {
    return "Preencha todos os campos do cartão."
  }
  if (
    !creditCardHolderInfo.name ||
    !creditCardHolderInfo.email ||
    !creditCardHolderInfo.cpfCnpj ||
    !creditCardHolderInfo.postalCode ||
    !creditCardHolderInfo.addressNumber
  ) {
    return "Preencha nome, e-mail, CPF, CEP e número do endereço do titular."
  }

  return { creditCard, creditCardHolderInfo }
}

export async function GET() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbershop não identificada" }, { status: 401 })
    }
    if (!(await isBillingEnabled())) {
      return NextResponse.json({ error: "Cobrança online não está ativa." }, { status: 503 })
    }
    const prefill = await getTrialCardSetupPrefill(barbershopId)
    return NextResponse.json({
      ok: true,
      prefill,
      in_app: true,
      environment: getAsaasEnvironment(),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar formulário" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbershop não identificada" }, { status: 401 })
    }

    const contentType = req.headers.get("content-type") ?? ""
    let body: unknown = null
    if (contentType.includes("application/json")) {
      body = await req.json().catch(() => null)
    }

    if (!body) {
      return NextResponse.json(
        { error: "Envie os dados do cartão em JSON (cadastro no app)." },
        { status: 400 }
      )
    }

    const parsed = parseCardBody(body)
    if (typeof parsed === "string") {
      return NextResponse.json({ error: parsed }, { status: 400 })
    }

    const remoteIp = getClientIpFromRequest(req)
    const result = await registerTrialCardInApp(barbershopId, parsed, remoteIp)
    return NextResponse.json({
      ok: true,
      in_app: true,
      card_setup_complete: true,
      ...result,
    })
  } catch (e) {
    console.error("[billing/setup-card]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao cadastrar cartão" },
      { status: 500 }
    )
  }
}
