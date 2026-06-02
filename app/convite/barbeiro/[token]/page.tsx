"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { compressImageToJpegDataUrl } from "@/lib/client-image-compress"
import { MAX_PROFILE_PHOTO_DATA_URL_CHARS } from "@/lib/photo-data-url"
import { formatCpfDisplay } from "@/lib/cpf"
import { BarberPhotoAdjust } from "@/components/barber-photo-adjust"
import { Camera, CheckCircle2, Loader2, Scissors } from "lucide-react"

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
  const [photoPosition, setPhotoPosition] = useState(50)
  const [photoScale, setPhotoScale] = useState(100)
  const [senha, setSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [portalToken, setPortalToken] = useState<string | null>(null)
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

  useEffect(() => {
    if (!token || typeof document === "undefined") return
    const href = `/convite/barbeiro/${encodeURIComponent(token)}/manifest`
    let link = document.querySelector(
      'link[rel="manifest"][data-trimtime-invite="1"]'
    ) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement("link")
      link.rel = "manifest"
      link.setAttribute("data-trimtime-invite", "1")
      document.head.appendChild(link)
    }
    link.href = href
    return () => {
      link?.remove()
    }
  }, [token])

  const onPickPhoto = useCallback(async (f: File | null) => {
    if (!f || !f.type.startsWith("image/")) {
      setFormError("Escolha um arquivo de imagem (JPG, PNG ou WebP).")
      return
    }
    setFormError(null)
    try {
      const dataUrl = await compressImageToJpegDataUrl(f)
      if (dataUrl.length > MAX_PROFILE_PHOTO_DATA_URL_CHARS) {
        setFormError("Imagem ainda grande demais. Tente outra foto.")
        return
      }
      setPhotoDataUrl(dataUrl)
      setPhotoPosition(50)
      setPhotoScale(100)
    } catch {
      setFormError("Não foi possível ler a imagem.")
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (senha.length < 6) {
      setFormError("A senha do app deve ter pelo menos 6 caracteres.")
      return
    }
    if (senha !== confirmarSenha) {
      setFormError("As senhas não coincidem.")
      return
    }
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
          photo_position: photoPosition,
          photo_scale: photoScale,
          password: senha,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string; portal_token?: string | null }
      if (!res.ok) {
        setFormError(typeof j.error === "string" ? j.error : "Não foi possível concluir o cadastro")
        return
      }
      setPortalToken(typeof j.portal_token === "string" ? j.portal_token : null)
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
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              O dono da barbearia verá seus dados e sua foto na equipe. Os clientes verão sua foto ao escolher o
              profissional no agendamento online.
            </p>
            {portalToken ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                <p className="text-sm font-medium text-foreground text-center">Seu app (agenda no celular)</p>
                <p className="text-xs text-muted-foreground text-center">
                  Guarde este link. Para entrar: mesmo e-mail e telefone do cadastro, a senha que você criou e o código
                  de 6 dígitos enviado por e-mail (OTP).
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    className="w-full"
                    asChild
                  >
                    <a href={`/profissional/${encodeURIComponent(portalToken)}`}>Abrir app do profissional</a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => {
                      const u = `${typeof window !== "undefined" ? window.location.origin : ""}/profissional/${portalToken}`
                      void navigator.clipboard.writeText(u)
                    }}
                  >
                    Copiar link do app
                  </Button>
                </div>
              </div>
            ) : null}
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
          <CardTitle className="text-foreground text-xl">Cadastro no app do profissional</CardTitle>
          <CardDescription>
            Mini app da Trim Time · <span className="text-foreground font-medium">{lojaNome}</span>
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

              <div className="rounded-xl border-2 border-dashed border-primary/35 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-foreground font-medium text-sm">
                  <Camera className="w-4 h-4 text-primary shrink-0" />
                  Foto de perfil <span className="text-destructive">*</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Obrigatória. Será exibida para os clientes quando escolherem você no agendamento online da barbearia.
                </p>
                <Input
                  id="foto"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="bg-input border-border cursor-pointer"
                  onChange={(e) => void onPickPhoto(e.target.files?.[0] ?? null)}
                />
                {photoDataUrl ? (
                  <div className="flex flex-col items-center pt-1 gap-2 w-full">
                    <BarberPhotoAdjust
                      photoUrl={photoDataUrl}
                      position={photoPosition}
                      scale={photoScale}
                      onPositionChange={setPhotoPosition}
                      onScaleChange={setPhotoScale}
                      previewSize="lg"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => {
                        setPhotoDataUrl(null)
                        setPhotoPosition(50)
                        setPhotoScale(100)
                      }}
                    >
                      Trocar foto
                    </Button>
                  </div>
                ) : null}
              </div>

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

              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">Senha do app (agenda e comissão)</p>
                <p className="text-xs text-muted-foreground">
                  Use esta senha junto com o código por e-mail sempre que abrir o app do profissional.
                </p>
                <Field>
                  <FieldLabel htmlFor="senha-app">Senha</FieldLabel>
                  <Input
                    id="senha-app"
                    type="password"
                    className="bg-input border-border"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirmar-senha">Confirmar senha</FieldLabel>
                  <Input
                    id="confirmar-senha"
                    type="password"
                    className="bg-input border-border"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </Field>
              </div>
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
