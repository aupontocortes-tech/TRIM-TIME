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

/** Lista cobranças da assinatura (qualquer status), mais recentes primeiro. */
export async function listAllSubscriptionPayments(
  subscriptionId: string,
  limit = "10"
): Promise<AsaasPayment[]> {
  const list = await asaasFetch<AsaasList<AsaasPayment>>(
    `/subscriptions/${subscriptionId}/payments`,
    { searchParams: { limit } }
  )
  return list.data ?? []
}

export async function getAsaasPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${paymentId}`)
}

/** Sandbox: confirma pagamento via API (equivalente a "Receber pagamento" no painel). */
export async function confirmSandboxAsaasPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/sandbox/payment/${paymentId}/confirm`, {
    method: "POST",
    body: JSON.stringify({}),
  })
}

/** Cobra cobrança pendente com token já tokenizado (assinatura / checkout). */
export async function payAsaasPaymentWithCreditCard(
  paymentId: string,
  input: {
    creditCardToken: string
    remoteIp: string
    creditCardHolderInfo: AsaasCreditCardHolderInput
  }
): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${paymentId}/payWithCreditCard`, {
    method: "POST",
    body: JSON.stringify({
      creditCardToken: input.creditCardToken,
      remoteIp: input.remoteIp,
      creditCardHolderInfo: input.creditCardHolderInfo,
    }),
  })
}

/** Desfaz confirmação manual "recebido em dinheiro" (ex.: cartão marcado errado no painel). */
export async function undoAsaasReceivedInCash(paymentId: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${paymentId}/undoReceivedInCash`, {
    method: "POST",
    body: JSON.stringify({}),
  })
}

export async function createAsaasPayment(input: {
  customerId: string
  billingType: AsaasBillingType
  value: number
  dueDate: string
  description: string
  externalReference?: string
  subscriptionId?: string
}): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: input.value,
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.externalReference,
      ...(input.subscriptionId ? { subscription: input.subscriptionId } : {}),
    }),
  })
}

export async function deleteAsaasPayment(paymentId: string): Promise<void> {
  await asaasFetch(`/payments/${paymentId}`, { method: "DELETE" })
}

export type AsaasRefundResult = {
  id: string
  status: string
  value: number
  description?: string
}

export type PixAutomaticAuthorization = {
  id: string
  status: string
  customerId: string
  subscriptionId?: string | null
  value?: number
  payload?: string | null
  encodedImage?: string | null
  immediateQrCode?: {
    conciliationIdentifier?: string
    expirationDate?: string
  } | null
}

export async function createPixAutomaticAuthorization(input: {
  customerId: string
  frequency: "MONTHLY"
  contractId: string
  startDate: string
  value: number
  description: string
  paymentCreationMode?: "SUBSCRIPTION" | "MANUAL"
  immediateQrCode: {
    expirationSeconds: number
    originalValue: number
    description: string
  }
}): Promise<PixAutomaticAuthorization> {
  return asaasFetch<PixAutomaticAuthorization>("/pix/automatic/authorizations", {
    method: "POST",
    body: JSON.stringify({
      customerId: input.customerId,
      frequency: input.frequency,
      contractId: input.contractId,
      startDate: input.startDate,
      value: input.value,
      description: input.description,
      paymentCreationMode: input.paymentCreationMode ?? "SUBSCRIPTION",
      immediateQrCode: input.immediateQrCode,
    }),
  })
}

export async function cancelPixAutomaticAuthorization(authorizationId: string): Promise<void> {
  await asaasFetch(`/pix/automatic/authorizations/${authorizationId}`, { method: "DELETE" })
}

export async function refundAsaasPayment(
  paymentId: string,
  input?: { value?: number; description?: string }
): Promise<AsaasRefundResult> {
  return asaasFetch<AsaasRefundResult>(`/payments/${paymentId}/refund`, {
    method: "POST",
    body: JSON.stringify({
      ...(input?.value != null ? { value: input.value } : {}),
      ...(input?.description ? { description: input.description } : {}),
    }),
  })
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
