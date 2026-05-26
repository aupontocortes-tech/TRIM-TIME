import type {
  AsaasCreditCardHolderInput,
  AsaasCreditCardInput,
} from "@/lib/asaas/card-types"
import { getAsaasApiBaseUrl, getAsaasApiKey } from "@/lib/asaas/config"

export type AsaasBillingType = "CREDIT_CARD" | "PIX" | "BOLETO" | "UNDEFINED"

export type AsaasCustomer = {
  id: string
  name: string
  email?: string
}

export type AsaasSubscription = {
  id: string
  customer: string
  billingType: AsaasBillingType
  value: number
  nextDueDate: string
  status: string
  cycle: string
  description?: string
}

export type AsaasPayment = {
  id: string
  customer: string
  subscription?: string
  billingType: AsaasBillingType
  value: number
  status: string
  dueDate: string
  invoiceUrl?: string
  bankSlipUrl?: string
  pixTransaction?: { encodedImage?: string; payload?: string }
}

type AsaasList<T> = { data: T[]; totalCount?: number }

class AsaasApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: { code?: string; description?: string }[]
  ) {
    super(message)
    this.name = "AsaasApiError"
  }
}

async function asaasFetch<T>(
  path: string,
  init?: RequestInit & { searchParams?: Record<string, string> }
): Promise<T> {
  const key = getAsaasApiKey()
  if (!key) throw new Error("ASAAS_API_KEY não configurada")

  const url = new URL(`${getAsaasApiBaseUrl()}${path}`)
  if (init?.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) {
      url.searchParams.set(k, v)
    }
  }

  const { searchParams: _s, ...rest } = init ?? {}
  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      access_token: key,
      ...(rest.headers as Record<string, string> | undefined),
    },
  })

  const body = (await res.json().catch(() => ({}))) as {
    errors?: { code?: string; description?: string }[]
    message?: string
  }

  if (!res.ok) {
    const desc =
      body.errors?.map((e) => e.description).filter(Boolean).join("; ") ||
      body.message ||
      res.statusText
    throw new AsaasApiError(desc, res.status, body.errors)
  }

  return body as T
}

export async function createAsaasCustomer(input: {
  name: string
  email: string
  mobilePhone?: string | null
  cpfCnpj?: string | null
  externalReference: string
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      mobilePhone: input.mobilePhone || undefined,
      cpfCnpj: input.cpfCnpj || undefined,
      externalReference: input.externalReference,
      notificationDisabled: false,
    }),
  })
}

export async function findAsaasCustomerByReference(
  externalReference: string
): Promise<AsaasCustomer | null> {
  const list = await asaasFetch<AsaasList<AsaasCustomer>>("/customers", {
    searchParams: { externalReference, limit: "1" },
  })
  return list.data?.[0] ?? null
}

export async function createAsaasSubscription(input: {
  customerId: string
  billingType: AsaasBillingType
  value: number
  nextDueDate: string
  description: string
  externalReference: string
}): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: input.value,
      nextDueDate: input.nextDueDate,
      cycle: "MONTHLY",
      description: input.description,
      externalReference: input.externalReference,
    }),
  })
}

export async function updateAsaasSubscription(
  subscriptionId: string,
  input: {
    value?: number
    billingType?: AsaasBillingType
    nextDueDate?: string
    updatePendingPayments?: boolean
  }
): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({
      value: input.value,
      billingType: input.billingType,
      nextDueDate: input.nextDueDate,
      updatePendingPayments: input.updatePendingPayments ?? true,
    }),
  })
}

export async function cancelAsaasSubscription(subscriptionId: string): Promise<void> {
  await asaasFetch(`/subscriptions/${subscriptionId}`, { method: "DELETE" })
}

export async function getAsaasSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(`/subscriptions/${subscriptionId}`)
}

export async function listSubscriptionPayments(
  subscriptionId: string,
  status = "PENDING"
): Promise<AsaasPayment[]> {
  const list = await asaasFetch<AsaasList<AsaasPayment>>(
    `/subscriptions/${subscriptionId}/payments`,
    { searchParams: { status, limit: "5" } }
  )
  return list.data ?? []
}

export async function getAsaasPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${paymentId}`)
}

export type CreditCardTokenizeResult = {
  creditCardToken: string
  creditCardNumber?: string
  creditCardBrand?: string
}

export async function tokenizeAsaasCreditCard(input: {
  customerId: string
  creditCard: AsaasCreditCardInput
  creditCardHolderInfo: AsaasCreditCardHolderInput
  remoteIp: string
}): Promise<CreditCardTokenizeResult> {
  const res = await asaasFetch<{
    creditCardToken?: string
    creditCardNumber?: string
    creditCardBrand?: string
  }>("/creditCard/tokenizeCreditCard", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      creditCard: input.creditCard,
      creditCardHolderInfo: input.creditCardHolderInfo,
      remoteIp: input.remoteIp,
    }),
  })
  if (!res.creditCardToken) {
    throw new AsaasApiError("Token do cartão não retornado pelo Asaas.", 500)
  }
  return {
    creditCardToken: res.creditCardToken,
    creditCardNumber: res.creditCardNumber,
    creditCardBrand: res.creditCardBrand,
  }
}

/** Atualiza cartão da assinatura sem cobrança imediata. */
export async function updateAsaasSubscriptionCreditCard(
  subscriptionId: string,
  input: {
    creditCardToken: string
    remoteIp: string
  }
): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(`/subscriptions/${subscriptionId}/creditCard`, {
    method: "PUT",
    body: JSON.stringify({
      creditCardToken: input.creditCardToken,
      remoteIp: input.remoteIp,
    }),
  })
}

export { AsaasApiError }
