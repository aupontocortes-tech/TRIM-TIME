export type AsaasCreditCardInput = {
  holderName: string
  number: string
  expiryMonth: string
  expiryYear: string
  ccv: string
}

export type AsaasCreditCardHolderInput = {
  name: string
  email: string
  cpfCnpj: string
  postalCode: string
  addressNumber: string
  addressComplement?: string
  phone: string
  mobilePhone?: string
}

export type TrialCardSetupPayload = {
  creditCard: AsaasCreditCardInput
  creditCardHolderInfo: AsaasCreditCardHolderInput
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

export function normalizeCardNumber(number: string): string {
  return digitsOnly(number)
}

export function normalizeExpiryMonth(month: string): string {
  const m = digitsOnly(month)
  if (m.length === 1) return `0${m}`
  return m.slice(0, 2)
}

export function normalizeExpiryYear(year: string): string {
  const y = digitsOnly(year)
  if (y.length === 2) return `20${y}`
  return y.slice(0, 4)
}
