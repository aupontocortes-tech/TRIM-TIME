"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InputOTP, InputOTPGroup, InputOTPSlot, REGEXP_ONLY_DIGITS } from "@/components/ui/input-otp"
import { Calendar, Clock, Loader2, LogOut, Scissors, Users, Wallet } from "lucide-react"
import type { Appointment, WaitingListItem } from "@/lib/db/types"
import { normalizePublicOtpCode } from "@/lib/public-otp-code"

const OTP_LEN = 6

function formatBrl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
}

function commissionLineForAppointment(
  a: Appointment,
  defaultPct: number
): { label: string; value: string } | null {
  const stored = a.commission_amount
  if (stored != null && Number.isFinite(stored)) {
    return { label: "Comissão", value: formatBrl(stored) }
  }
  const total = a.total_price
  if (total == null || !Number.isFinite(total) || total <= 0) return null
  const pct = a.commission_percent ?? defaultPct
  if (!Number.isFinite(pct) || pct <= 0) return null
  const est = Math.round(total * (pct / 100) * 100) / 100
  return { label: "Comissão (estimada)", value: formatBrl(est) }
}

function toYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function monthRangeYMD(ref: Date): { from: string; to: string } {
  const y = ref.getFullYear()
  const mo = ref.getMonth()
  const last = new Date(y, mo + 1, 0).getDate()
  const from = `${y}-${String(mo + 1).padStart(2, "0")}-01`
  const to = `${y}-${String(mo + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`
  return { from, to }
}

function weekRangeYMD(ref: Date): { from: string; to: string } {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const dow = d.getDay()
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: toYMD(monday), to: toYMD(sunday) }
}

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

function formatDataPt(ymd: string) {
  const [y, m, day] = ymd.split("-").map(Number)
  const dt = new Date(y, (m || 1) - 1, day || 1)
  return `${diasSemana[dt.getDay()]}, ${day}/${m}`
}

export default function ProfissionalAppPage() {
  const params = useParams()
  const portalToken = String(params?.portalToken ?? "").trim()

  const [metaLoading, setMetaLoading] = useState(true)
  const [metaErr, setMetaErr] = useState<string | null>(null)
  const [shopName, setShopName] = useState("")
  const [barberName, setBarberName] = useState("")
  const [hasPassword, setHasPassword] = useState(false)
  const [myCommissionPct, setMyCommissionPct] = useState(0)

  const [auth, setAuth] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)

  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [password, setPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authErr, setAuthErr] = useState("")

  const [visao, setVisao] = useState<"dia" | "semana" | "mes">("dia")
  const [refDate, setRefDate] = useState(() => new Date())
  const [agenda, setAgenda] = useState<Appointment[]>([])
  const [agendaLoading, setAgendaLoading] = useState(false)
  const [waitlist, setWaitlist] = useState<WaitingListItem[]>([])
  const [waitlistEnabled, setWaitlistEnabled] = useState(false)
  const [waitlistMsg, setWaitlistMsg] = useState<string | null>(null)
  const [showWaitlist, setShowWaitlist] = useState(true)

  const base = `/api/public/barber-portal/${encodeURIComponent(portalToken)}`

  useEffect(() => {
    if (!portalToken) return
    let link = document.querySelector('link[rel="manifest"][data-trimtime-prof="1"]') as HTMLLinkElement | null
    if (!link) {
      link = document.createElement("link")
      link.rel = "manifest"
      link.setAttribute("data-trimtime-prof", "1")
      document.head.appendChild(link)
    }
    link.href = `/profissional/${encodeURIComponent(portalToken)}/manifest`
    return () => link?.remove()
  }, [portalToken])

  useEffect(() => {
    if (!portalToken) return
    let cancelled = false
    setMetaLoading(true)
    fetch(`${base}/meta`)
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as {
          error?: string
          barbershop_name?: string
          barber_name?: string
          has_password?: boolean
          commission_percent?: number
        }
        if (cancelled) return
        if (!r.ok) {
          setMetaErr(j.error || "Link inválido")
          return
        }
        setShopName(j.barbershop_name ?? "")
        setBarberName(j.barber_name ?? "")
        setHasPassword(!!j.has_password)
        const commissionPct = j.commission_percent
        setMyCommissionPct(
          typeof commissionPct === "number" && Number.isFinite(commissionPct) ? commissionPct : 0
        )
      })
      .catch(() => {
        if (!cancelled) setMetaErr("Erro de rede")
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [portalToken, base])

  const checkSession = useCallback(async () => {
    if (!portalToken) return
    setSessionLoading(true)
    try {
      const r = await fetch(`${base}/session`, { credentials: "include" })
      const j = (await r.json().catch(() => ({}))) as { authenticated?: boolean }
      setAuth(!!j.authenticated)
    } catch {
      setAuth(false)
    } finally {
      setSessionLoading(false)
    }
  }, [portalToken, base])

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  const rangeParams = useMemo(() => {
    if (visao === "dia") return `date=${encodeURIComponent(toYMD(refDate))}`
    if (visao === "semana") {
      const { from, to } = weekRangeYMD(refDate)
      return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    }
    const { from, to } = monthRangeYMD(refDate)
    return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  }, [visao, refDate])

  const loadAgenda = useCallback(async () => {
    if (!auth || !portalToken) return
    setAgendaLoading(true)
    try {
      const r = await fetch(`${base}/appointments?${rangeParams}`, { credentials: "include" })
      const data = await r.json().catch(() => [])
      setAgenda(r.ok && Array.isArray(data) ? data : [])
    } catch {
      setAgenda([])
    } finally {
      setAgendaLoading(false)
    }
  }, [auth, portalToken, base, rangeParams])

  const loadWaitlist = useCallback(async () => {
    if (!auth || !portalToken) return
    try {
      const r = await fetch(`${base}/waitlist`, { credentials: "include" })
      const j = (await r.json().catch(() => ({}))) as {
        enabled?: boolean
        items?: WaitingListItem[]
        message?: string
      }
      setWaitlistEnabled(!!j.enabled)
      setWaitlist(Array.isArray(j.items) ? j.items : [])
      setWaitlistMsg(typeof j.message === "string" ? j.message : null)
    } catch {
      setWaitlist([])
      setWaitlistEnabled(false)
    }
  }, [auth, portalToken, base])

  useEffect(() => {
    void loadAgenda()
  }, [loadAgenda])

  useEffect(() => {
    void loadWaitlist()
  }, [loadWaitlist])

  const sendOtp = async () => {
    setAuthErr("")
    setAuthBusy(true)
    try {
      const r = await fetch(`${base}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), telefone }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setAuthErr(j.error || "Não foi possível enviar o código")
        return
      }
      setOtpSent(true)
    } catch {
      setAuthErr("Erro de rede")
    } finally {
      setAuthBusy(false)
    }
  }

  const verify = async () => {
    setAuthErr("")
    const code = normalizePublicOtpCode(otpCode)
    if (code.length < OTP_LEN) {
      setAuthErr(`Digite os ${OTP_LEN} dígitos do código.`)
      return
    }
    if (hasPassword && !password) {
      setAuthErr("Informe sua senha.")
      return
    }
    if (!hasPassword) {
      if (newPassword.length < 6) {
        setAuthErr("A senha deve ter pelo menos 6 caracteres.")
        return
      }
      if (newPassword !== confirmPassword) {
        setAuthErr("As senhas não coincidem.")
        return
      }
    }
    setAuthBusy(true)
    try {
      const r = await fetch(`${base}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          telefone,
          code,
          ...(hasPassword ? { password } : { new_password: newPassword }),
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setAuthErr(j.error || "Não foi possível entrar")
        return
      }
      setAuth(true)
      setOtpSent(false)
      setOtpCode("")
      setPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      setAuthErr("Erro de rede")
    } finally {
      setAuthBusy(false)
    }
  }

  const logout = async () => {
    await fetch(`${base}/session`, { method: "DELETE", credentials: "include" })
    setAuth(false)
    setOtpSent(false)
    setOtpCode("")
  }

  const mudarPeriodo = (delta: number) => {
    const n = new Date(refDate)
    if (visao === "dia") n.setDate(n.getDate() + delta)
    else if (visao === "semana") n.setDate(n.getDate() + delta * 7)
    else n.setMonth(n.getMonth() + delta)
    setRefDate(n)
  }

  const porDia = useMemo(() => {
    const m = new Map<string, Appointment[]>()
    for (const a of agenda) {
      const key = a.date ?? ""
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(a)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [agenda])

  if (!portalToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <p className="text-muted-foreground">Link inválido</p>
      </div>
    )
  }

  if (metaLoading || sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  if (metaErr) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full border-border">
          <CardHeader>
            <CardTitle>Indisponível</CardTitle>
            <CardDescription>{metaErr}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!auth) {
    return (
      <div className="min-h-screen bg-background p-4 py-10">
        <Card className="max-w-md mx-auto border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Entrar</CardTitle>
            <CardDescription>
              {barberName} · {shopName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Use o mesmo e-mail e telefone do cadastro. Enviaremos um código de {OTP_LEN} dígitos por e-mail (OTP).{" "}
              {hasPassword
                ? "Informe a senha que você criou no cadastro (ou definiu no primeiro acesso ao app)."
                : "No primeiro acesso, após o código, você define a senha do app."}
            </p>
            {authErr ? (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {authErr}
              </div>
            ) : null}
            <div>
              <Label htmlFor="em">E-mail</Label>
              <Input
                id="em"
                type="email"
                className="mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="tel">Telefone (WhatsApp)</Label>
              <Input
                id="tel"
                type="tel"
                className="mt-1"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                autoComplete="tel"
              />
            </div>
            {hasPassword ? (
              <div>
                <Label htmlFor="pw">Senha do app</Label>
                <Input
                  id="pw"
                  type="password"
                  className="mt-1"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            ) : null}

            {!otpSent ? (
              <Button className="w-full" disabled={authBusy} onClick={() => void sendOtp()}>
                {authBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Receber código por e-mail
              </Button>
            ) : (
              <>
                <div>
                  <Label>Código do e-mail</Label>
                  <div className="mt-2 flex justify-center">
                    <InputOTP
                      maxLength={OTP_LEN}
                      pattern={REGEXP_ONLY_DIGITS}
                      value={otpCode}
                      onChange={(v) => setOtpCode(v)}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: OTP_LEN }).map((_, i) => (
                          <InputOTPSlot key={i} index={i} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>
                {!hasPassword ? (
                  <>
                    <div>
                      <Label htmlFor="np">Nova senha (mín. 6)</Label>
                      <Input
                        id="np"
                        type="password"
                        className="mt-1"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cp">Confirmar senha</Label>
                      <Input
                        id="cp"
                        type="password"
                        className="mt-1"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                  </>
                ) : null}
                <Button className="w-full" disabled={authBusy} onClick={() => void verify()}>
                  {authBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Entrar
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setOtpSent(false)}>
                  Voltar
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{barberName}</p>
          <p className="text-xs text-muted-foreground truncate">{shopName}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
          <LogOut className="w-4 h-4 mr-1" />
          Sair
        </Button>
      </header>

      <div className="px-4 pt-4 space-y-4 max-w-lg mx-auto">
        <p className="text-xs text-muted-foreground">
          Você vê só os seus horários. Bloqueios de agenda são feitos pelo dono da barbearia no painel.
        </p>

        <Card className="border-border border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Comissão
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="text-foreground">
              Percentual na sua ficha:{" "}
              <span className="font-semibold tabular-nums">
                {myCommissionPct > 0 ? `${myCommissionPct.toLocaleString("pt-BR")}%` : "0% (plano sem comissão ou não configurado)"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Em cada horário aparece o valor quando a barbearia registrou a venda, ou uma estimativa com base no
              total do agendamento e no percentual.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          {(["dia", "semana", "mes"] as const).map((v) => (
            <Button
              key={v}
              type="button"
              size="sm"
              variant={visao === v ? "default" : "outline"}
              onClick={() => setVisao(v)}
            >
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => mudarPeriodo(-1)}>
            ‹
          </Button>
          <p className="text-sm font-medium text-foreground text-center flex-1">
            {visao === "dia"
              ? toYMD(refDate)
              : visao === "semana"
                ? `Semana ${weekRangeYMD(refDate).from} – ${weekRangeYMD(refDate).to}`
                : `${refDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
          </p>
          <Button type="button" variant="outline" size="icon" onClick={() => mudarPeriodo(1)}>
            ›
          </Button>
        </div>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Agenda
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agendaLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : porDia.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum agendamento neste período.</p>
            ) : (
              <div className="space-y-4">
                {porDia.map(([ymd, list]) => (
                  <div key={ymd}>
                    <p className="text-xs font-medium text-muted-foreground mb-2">{formatDataPt(ymd)}</p>
                    <ul className="space-y-2">
                      {list.map((a) => {
                        const comm = commissionLineForAppointment(a, myCommissionPct)
                        return (
                        <li
                          key={a.id}
                          className="rounded-lg border border-border bg-card/50 p-3 text-sm"
                        >
                          <div className="flex items-center gap-2 text-foreground font-medium">
                            <Clock className="w-4 h-4 shrink-0 text-primary" />
                            {String(a.time).slice(0, 5)} · {a.status}
                          </div>
                          <p className="mt-1 text-foreground">{a.client?.name ?? "Cliente"}</p>
                          <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
                            <Scissors className="w-3 h-3" />
                            {a.service_lines?.length
                              ? a.service_lines.map((l) => l.service?.name ?? "Serviço").join(", ")
                              : a.service?.name ?? "Serviço"}
                          </p>
                          {a.total_price != null && Number.isFinite(a.total_price) ? (
                            <p className="text-xs text-muted-foreground mt-1">
                              Total agendamento: {formatBrl(a.total_price)}
                            </p>
                          ) : null}
                          {comm ? (
                            <p className="text-xs font-medium text-primary mt-1">
                              {comm.label}: {comm.value}
                            </p>
                          ) : null}
                        </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Lista de espera
            </CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowWaitlist((s) => !s)}>
              {showWaitlist ? "Ocultar" : "Mostrar"}
            </Button>
          </CardHeader>
          {showWaitlist ? (
            <CardContent>
              {!waitlistEnabled ? (
                <p className="text-sm text-muted-foreground">{waitlistMsg ?? "Indisponível no plano da loja."}</p>
              ) : waitlist.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ninguém na sua fila no momento.</p>
              ) : (
                <ul className="space-y-2">
                  {waitlist.map((w) => (
                    <li key={w.id} className="rounded-md border border-border p-2 text-sm">
                      <p className="font-medium text-foreground">{w.client?.name ?? "Cliente"}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.service?.name ?? "Serviço"} · {w.desired_date ?? "—"}{" "}
                        {w.desired_time ? `· ${w.desired_time.slice(0, 5)}` : ""}
                      </p>
                      <p className="text-xs capitalize mt-1">Status: {w.status}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
