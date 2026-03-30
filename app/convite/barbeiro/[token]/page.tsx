"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { compressImageToJpegDataUrl } from "@/lib/client-image-compress"
import { formatCpfDisplay } from "@/lib/cpf"
import { CheckCircle2, Loader2, Scissors } from "lucide-react"

type Meta =
  | { loading: true }
  | { loading: false; error: string }
  | { loading: false; error: null; barbershop_name: string; slug: string; expires_at: string }

export default function ConviteBarbeiroPage() {
  const routeParams = useParams()
  const token = String(routeParams?.token ?? "").trim()
  const [meta, setMeta] = useState<Meta>({ loading: true })
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [cpf, setCpf] = useState("")
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || token.length < 32) {
      setMeta({ loading: false, error: "Link inválido" })
      return
    }
    let cancelled = false
    fetch(`/api/public/barber-invite/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as {
          error?: string
          ok?: boolean
          barbershop_name?: string
          slug?: string
          expires_at?: string
        }
        if (cancelled) return
        if (!r.ok) {
          setMeta({ loading: false, error: typeof j.error === "string" ? j.error : "Convite indisponível" })
          return
        }
        setMeta({
          loading: false,
          error: null,
          barbershop_name: j.barbershop_name ?? "Barbearia",
          slug: j.slug ?? "",
          expires_at: j.expires_at ?? "",
        })
      })
      .catch(() => {
        if (!cancelled) setMeta({ loading: false, error: "Erro de rede" })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const onPickPhoto = useCallback(async (f: File | null) => {
    if (!f || !f.type.startsWith("image/")) {
      setFormError("Escolha um arquivo de imagem (JPG, PNG ou WebP).")
      return
    }
    setFormError(null)
    try {
      const dataUrl = await compressImageToJpegDataUrl(f, 640, 0.8)
      if (dataUrl.length > 400_000) {
        setFormError("Imagem ainda grande demais. Tente outra foto.")
        return
      }
      setPhotoDataUrl(dataUrl)
    } catch {
      setFormError("Não foi possível ler a imagem.")
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/public/barber-invite/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nome,
          email,
          phone: telefone,
          cpf,
          photo_url: photoDataUrl,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setFormError(typeof j.error === "string" ? j.error : "Não foi possível concluir o cadastro")
        return
      }
      setDone(true)
    } catch {
      setFormError("Erro de rede. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  if (meta.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!meta.loading && typeof meta.error === "string") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-border bg-card">
          <TabHeader />
          <CardContent className="pt-0">
            <p className="text-destructive text-sm">{meta.error}</p>
            <p className="text-muted-foreground text-sm mt-4">
              Peça um novo link ao responsável pela barbearia em Configurações → Equipe.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (done && !meta.loading && meta.error === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-border bg-card">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <CheckCircle2 className="w-14 h-14 text-green-500" />
            </div>
            <CardTitle className="text-center text-foreground">Cadastro concluído</CardTitle>
            <CardDescription className="text-center">
              Você já faz parte da equipe de <strong className="text-foreground">{meta.barbershop_name}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              O dono da barbearia verá seus dados na lista de profissionais. Em breve você poderá aparecer na agenda
              pública com sua foto.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const lojaNome = meta.barbershop_name
  const expira = new Date(meta.expires_at).toLocaleString("pt-BR")

  return (
    <div className="min-h-screen bg-background p-4 py-10">
      <Card className="max-w-lg mx-auto border-border bg-card shadow-lg">
        <TabHeader />
        <CardHeader>
          <CardTitle className="text-foreground text-xl">Cadastro de profissional</CardTitle>
          <CardDescription>
            <span className="text-foreground font-medium">{lojaNome}</span>
            {expira ? (
              <span className="block mt-1 text-xs">Link válido até {expira}</span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {formError ? (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {formError}
              </div>
            ) : null}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="nome">Nome completo</FieldLabel>
                <Input
                  id="nome"
                  className="bg-input border-border"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  autoComplete="name"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  className="bg-input border-border"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="tel">Telefone / WhatsApp</FieldLabel>
                <Input
                  id="tel"
                  className="bg-input border-border"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  required
                  autoComplete="tel"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cpf">CPF</FieldLabel>
                <Input
                  id="cpf"
                  className="bg-input border-border"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpfDisplay(e.target.value))}
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={14}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="foto">Foto de perfil</FieldLabel>
                <Input
                  id="foto"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="bg-input border-border cursor-pointer"
                  onChange={(e) => void onPickPhoto(e.target.files?.[0] ?? null)}
                />
                {photoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoDataUrl} alt="" className="mt-3 w-28 h-28 rounded-full object-cover border border-border" />
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">Obrigatório — será exibida na equipe e no agendamento.</p>
                )}
              </Field>
            </FieldGroup>
            <Button
              type="submit"
              disabled={busy || !photoDataUrl}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Concluir cadastro"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function TabHeader() {
  return (
    <CardHeader className="pb-2 border-b border-border">
      <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
        <Scissors className="w-4 h-4 text-primary" />
        Trim Time
      </Link>
    </CardHeader>
  )
}
