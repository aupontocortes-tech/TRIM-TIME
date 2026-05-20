"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CreditCard, Lock } from "lucide-react"
type Prefill = {
  name: string
  email: string
  phone: string | null
  postalCode: string | null
  addressNumber: string | null
}

type TrialCardFormProps = {
  onSuccess: () => void
  onError?: (message: string) => void
}

function formatCpf(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function formatCep(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function formatCardNumber(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 16)
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim()
}

export function TrialCardForm({ onSuccess, onError }: TrialCardFormProps) {
  const [loadingPrefill, setLoadingPrefill] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [holderName, setHolderName] = useState("")
  const [cardNumber, setCardNumber] = useState("")
  const [expiryMonth, setExpiryMonth] = useState("")
  const [expiryYear, setExpiryYear] = useState("")
  const [ccv, setCcv] = useState("")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cpfCnpj, setCpfCnpj] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [addressNumber, setAddressNumber] = useState("")
  const [phone, setPhone] = useState("")

  const [isSandbox, setIsSandbox] = useState(false)

  const loadPrefill = useCallback(async () => {
    setLoadingPrefill(true)
    setErr(null)
    try {
      const r = await fetch("/api/billing/setup-card", { credentials: "include" })
      const j = await r.json()
      if (!r.ok) {
        const msg = j.error || "Não foi possível carregar o formulário"
        setErr(msg)
        onError?.(msg)
        return
      }
      setIsSandbox(j.environment === "sandbox")
      const p = j.prefill as Prefill | undefined
      if (p) {
        setName(p.name)
        setEmail(p.email)
        setPhone(p.phone?.replace(/\D/g, "") ?? "")
        if (p.postalCode) setPostalCode(formatCep(p.postalCode))
        if (p.addressNumber) setAddressNumber(p.addressNumber)
        setHolderName(p.name)
      }
    } catch {
      const msg = "Erro de rede ao carregar formulário"
      setErr(msg)
      onError?.(msg)
    } finally {
      setLoadingPrefill(false)
    }
  }, [onError])

  useEffect(() => {
    void loadPrefill()
  }, [loadPrefill])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErr(null)
    try {
      const r = await fetch("/api/billing/setup-card", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditCard: {
            holderName,
            number: cardNumber.replace(/\D/g, ""),
            expiryMonth,
            expiryYear,
            ccv,
          },
          creditCardHolderInfo: {
            name,
            email,
            cpfCnpj: cpfCnpj.replace(/\D/g, ""),
            postalCode: postalCode.replace(/\D/g, ""),
            addressNumber,
            phone: phone.replace(/\D/g, "") || phone,
            mobilePhone: phone.replace(/\D/g, "") || undefined,
          },
        }),
      })
      const j = await r.json()
      if (!r.ok) {
        const msg = j.error || "Não foi possível cadastrar o cartão"
        setErr(msg)
        onError?.(msg)
        return
      }
      onSuccess()
    } catch {
      const msg = "Erro de rede"
      setErr(msg)
      onError?.(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingPrefill) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Dados do cartão
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="holderName">Nome no cartão</Label>
            <Input
              id="holderName"
              autoComplete="cc-name"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="cardNumber">Número do cartão</Label>
            <Input
              id="cardNumber"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expiryMonth">Mês</Label>
            <Input
              id="expiryMonth"
              inputMode="numeric"
              placeholder="MM"
              maxLength={2}
              value={expiryMonth}
              onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expiryYear">Ano</Label>
            <Input
              id="expiryYear"
              inputMode="numeric"
              placeholder="AAAA"
              maxLength={4}
              value={expiryYear}
              onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ccv">CVV</Label>
            <Input
              id="ccv"
              inputMode="numeric"
              autoComplete="cc-csc"
              maxLength={4}
              value={ccv}
              onChange={(e) => setCcv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              required
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <p className="text-sm font-medium">Titular do cartão</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="holderFullName">Nome completo</Label>
            <Input id="holderFullName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="holderEmail">E-mail</Label>
            <Input
              id="holderEmail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              inputMode="numeric"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(formatCpf(e.target.value))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cep">CEP</Label>
            <Input
              id="cep"
              inputMode="numeric"
              value={postalCode}
              onChange={(e) => setPostalCode(formatCep(e.target.value))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addressNumber">Número</Label>
            <Input
              id="addressNumber"
              value={addressNumber}
              onChange={(e) => setAddressNumber(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      {isSandbox ? (
        <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
          Sandbox: use cartão de teste Asaas (ex.: 5162 3062 1937 8829, validade futura, CVV 318). CPF de teste
          conforme a documentação do Asaas.
        </p>
      ) : null}

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Pagamento processado com segurança pela Asaas. Os dados do cartão não são armazenados nos servidores do
          Trim Time.
        </span>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
        Cadastrar cartão e iniciar teste
      </Button>
    </form>
  )
}
