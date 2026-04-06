"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useBarbershop } from "@/hooks/use-barbershop"
import { useUnits } from "@/hooks/use-units"
import { hasFeature, PLAN_FEATURES, PLAN_LABELS, PLAN_PRICES } from "@/lib/plans"
import type {
  Barber,
  Service,
  BarbershopUnit,
  SubscriptionPlan,
} from "@/lib/db/types"
import {
  defaultHorariosUi,
  openingHoursFromSettings,
  openingHoursToSettings,
  DIAS_SEMANA_KEYS,
  type HorarioDiaUi,
} from "@/lib/barbershop-settings-ui"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatCpfDisplay } from "@/lib/cpf"
import { compressImageToJpegDataUrl } from "@/lib/client-image-compress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Store,
  Clock,
  Users,
  Scissors,
  Save,
  Plus,
  Trash2,
  Edit2,
  Link as LinkIcon,
  Copy,
  Check,
  Share2,
  QrCode,
  Shield,
  Smartphone,
  Building2,
  UserPlus,
  Bell,
  ExternalLink,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { renderNotificationTemplate } from "@/lib/notification-template"

const diasSemana = [
  { key: "segunda" as const, label: "Segunda-feira" },
  { key: "terca" as const, label: "Terça-feira" },
  { key: "quarta" as const, label: "Quarta-feira" },
  { key: "quinta" as const, label: "Quinta-feira" },
  { key: "sexta" as const, label: "Sexta-feira" },
  { key: "sabado" as const, label: "Sábado" },
  { key: "domingo" as const, label: "Domingo" },
]

type BarbeariaForm = {
  nome: string
  email: string
  telefone: string
  endereco: string
  cidade: string
  estado: string
  cep: string
}

const emptyBarbearia: BarbeariaForm = {
  nome: "",
  email: "",
  telefone: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
}

const REMINDER_OFFSET_OPTIONS = [
  { minutes: 30, label: "30 minutos antes" },
  { minutes: 60, label: "1 hora antes" },
  { minutes: 120, label: "2 horas antes" },
  { minutes: 1440, label: "1 dia antes" },
] as const

const WHATSAPP_PARTNER_LINKS = [
  {
    name: "Twilio",
    href: "https://www.twilio.com/whatsapp",
    description: "Configuração fácil e integração com API oficial do WhatsApp",
  },
  {
    name: "Zenvia",
    href: "https://www.zenvia.com/whatsapp-business/",
    description: "Configuração fácil e integração com API oficial do WhatsApp",
  },
  {
    name: "360dialog",
    href: "https://www.360dialog.com/",
    description: "Configuração fácil e integração com API oficial do WhatsApp",
  },
] as const

const DEFAULT_APP_REMINDER =
  "Olá {{nome_cliente}}! Lembrete: você tem {{servico}} na {{barbearia}} em {{data}} às {{horario}}."

const DEFAULT_WA_REMINDER = "Olá {{nome}}, lembrando do seu horário amanhã às {{hora}}."

const DEFAULT_WA_CONFIRM =
  "Olá {{nome}}, seu horário está confirmado para {{data}} às {{hora}}."

const DEFAULT_WA_POST = "Obrigado pela preferência! Esperamos você novamente."

const ALLOWED_REMINDER_MINUTES = new Set<number>([30, 60, 120, 1440])

/** Na área WhatsApp (especificação): só 1 h, 2 h e 1 dia — o card “Lembretes” acima mantém também 30 min. */
const WA_SECTION_REMINDER_OPTIONS = [
  { minutes: 60, label: "1 hora antes" },
  { minutes: 120, label: "2 horas antes" },
  { minutes: 1440, label: "1 dia antes" },
] as const

export default function ConfiguracoesPage() {
  const {
    plan,
    subscription,
    barbershop,
    loading: barbershopLoading,
    error: barbershopError,
    refetch,
  } = useBarbershop()
  const {
    units,
    selectedUnitId,
    loading: unitsLoading,
    changeUnit,
    refetch: refetchUnits,
  } = useUnits()
  const commissionFeature =
    barbershop?.role === "super_admin" ||
    barbershop?.is_test === true ||
    (plan != null && hasFeature(plan, "barber_commission"))
  const multiUnitsFeature =
    barbershop?.role === "super_admin" ||
    barbershop?.is_test === true ||
    (plan != null && hasFeature(plan, "multi_units"))
  const whatsappIntegrationFeature =
    barbershop?.role === "super_admin" ||
    barbershop?.is_test === true ||
    (plan != null && hasFeature(plan, "whatsapp_integration"))

  const [barbearia, setBarbearia] = useState<BarbeariaForm>(emptyBarbearia)
  const [horarios, setHorarios] = useState<
    Record<(typeof DIAS_SEMANA_KEYS)[number], HorarioDiaUi>
  >(() => defaultHorariosUi())

  const [listaServicos, setListaServicos] = useState<Service[]>([])
  const [servicosLoading, setServicosLoading] = useState(true)
  const [servicosError, setServicosError] = useState<string | null>(null)
  const [servicoBusy, setServicoBusy] = useState(false)

  const [addServOpen, setAddServOpen] = useState(false)
  const [newServNome, setNewServNome] = useState("")
  const [newServDuracao, setNewServDuracao] = useState("30")
  const [newServPreco, setNewServPreco] = useState("")

  const [editServOpen, setEditServOpen] = useState(false)
  const [editingServ, setEditingServ] = useState<Service | null>(null)
  const [editServNome, setEditServNome] = useState("")
  const [editServDuracao, setEditServDuracao] = useState("")
  const [editServPreco, setEditServPreco] = useState("")
  const [editServAtivo, setEditServAtivo] = useState(true)

  const [barbers, setBarbers] = useState<Barber[]>([])
  const [barbersLoading, setBarbersLoading] = useState(true)
  const [equipeError, setEquipeError] = useState<string | null>(null)
  const [equipeBusy, setEquipeBusy] = useState(false)
  const [origin, setOrigin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""))
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newCommission, setNewCommission] = useState("50")
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Barber | null>(null)
  const [editName, setEditName] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editCpf, setEditCpf] = useState("")
  const [editPhotoDraft, setEditPhotoDraft] = useState<string | null>(null)
  const [editCommission, setEditCommission] = useState("50")
  const [editActive, setEditActive] = useState(true)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [linkCompartilhado, setLinkCompartilhado] = useState(false)
  const [msgClienteCopiada, setMsgClienteCopiada] = useState(false)

  const [waLoading, setWaLoading] = useState(false)
  const [waError, setWaError] = useState<string | null>(null)
  const [waPhone, setWaPhone] = useState("")
  const [waGraphId, setWaGraphId] = useState("")
  const [waToken, setWaToken] = useState("")
  const [waClearToken, setWaClearToken] = useState(false)
  const [waBusy, setWaBusy] = useState(false)
  const [waConnectOpen, setWaConnectOpen] = useState(false)
  const [waProvider, setWaProvider] = useState("meta")
  const [waHasApiToken, setWaHasApiToken] = useState(false)
  /** GET /api/whatsapp retornou 403: credenciais só persistem no Premium; não limpamos o que o usuário digita. */
  const [waPlanBlocked, setWaPlanBlocked] = useState(false)
  const [notifWaConfirmTpl, setNotifWaConfirmTpl] = useState(DEFAULT_WA_CONFIRM)
  const [notifWaPostTpl, setNotifWaPostTpl] = useState(DEFAULT_WA_POST)
  const [notifCustomReminderHours, setNotifCustomReminderHours] = useState("")
  const [notifMetaTplConfirm, setNotifMetaTplConfirm] = useState("")
  const [notifMetaTplReminder, setNotifMetaTplReminder] = useState("")
  const [notifMetaTplPost, setNotifMetaTplPost] = useState("")

  const [notifReminderOffsets, setNotifReminderOffsets] = useState<number[]>([60])
  const [notifApp, setNotifApp] = useState(true)
  const [notifWa, setNotifWa] = useState(false)
  const [notifAppTpl, setNotifAppTpl] = useState(DEFAULT_APP_REMINDER)
  const [notifWaTpl, setNotifWaTpl] = useState(DEFAULT_WA_REMINDER)
  const [notifBusy, setNotifBusy] = useState(false)
  const [notifOk, setNotifOk] = useState(false)
  const [notifError, setNotifError] = useState<string | null>(null)
  const [unitBusy, setUnitBusy] = useState(false)
  const [unitError, setUnitError] = useState<string | null>(null)
  const [newUnitName, setNewUnitName] = useState("")
  const [newUnitPhone, setNewUnitPhone] = useState("")
  const [newUnitAddress, setNewUnitAddress] = useState("")
  const [newUnitCity, setNewUnitCity] = useState("")
  const [newUnitState, setNewUnitState] = useState("")
  const [newUnitCep, setNewUnitCep] = useState("")
  const [unitEditOpen, setUnitEditOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<BarbershopUnit | null>(null)
  const [editUnitName, setEditUnitName] = useState("")
  const [editUnitPhone, setEditUnitPhone] = useState("")
  const [editUnitAddress, setEditUnitAddress] = useState("")
  const [editUnitCity, setEditUnitCity] = useState("")
  const [editUnitState, setEditUnitState] = useState("")
  const [editUnitCep, setEditUnitCep] = useState("")
  const [subscriptionBusy, setSubscriptionBusy] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  const [subscriptionOk, setSubscriptionOk] = useState<string | null>(null)

  useEffect(() => {
    // Garante que o origin já venha correto mesmo após navegações dentro do painel.
    setOrigin(typeof window !== "undefined" ? window.location.origin : "")
  }, [])

  useEffect(() => {
    if (!barbershop) return
    setBarbearia({
      nome: barbershop.name,
      email: barbershop.email,
      telefone: barbershop.phone ?? "",
      endereco: barbershop.settings?.address ?? "",
      cidade: barbershop.settings?.city ?? "",
      estado: barbershop.settings?.state ?? "",
      cep: barbershop.settings?.cep ?? "",
    })
    setHorarios(openingHoursFromSettings(barbershop.settings?.opening_hours))
  }, [
    barbershop?.id,
    barbershop?.updated_at,
    barbershop?.name,
    barbershop?.email,
    barbershop?.phone,
    JSON.stringify(barbershop?.settings ?? null),
  ])

  useEffect(() => {
    if (!barbershop) return
    const ns = barbershop.settings?.notification_settings
    if (!ns) {
      setNotifReminderOffsets([60])
      setNotifApp(true)
      setNotifWa(false)
      setNotifAppTpl(DEFAULT_APP_REMINDER)
      setNotifWaTpl(DEFAULT_WA_REMINDER)
      setNotifWaConfirmTpl(DEFAULT_WA_CONFIRM)
      setNotifWaPostTpl(DEFAULT_WA_POST)
      setNotifCustomReminderHours("")
      setNotifMetaTplConfirm("")
      setNotifMetaTplReminder("")
      setNotifMetaTplPost("")
      return
    }
    const offs = (ns.reminder_offsets_minutes ?? [60]).filter((m) => ALLOWED_REMINDER_MINUTES.has(m))
    setNotifReminderOffsets(offs.length ? [...new Set(offs)].sort((a, b) => a - b) : [60])
    setNotifApp(ns.notify_app !== false)
    setNotifWa(ns.notify_whatsapp === true)
    setNotifAppTpl(ns.app_reminder_template?.trim() ? ns.app_reminder_template : DEFAULT_APP_REMINDER)
    setNotifWaTpl(ns.whatsapp_reminder_template?.trim() ? ns.whatsapp_reminder_template : DEFAULT_WA_REMINDER)
    setNotifWaConfirmTpl(
      ns.whatsapp_confirmation_template?.trim() ? ns.whatsapp_confirmation_template : DEFAULT_WA_CONFIRM
    )
    setNotifWaPostTpl(ns.whatsapp_post_service_template?.trim() ? ns.whatsapp_post_service_template : DEFAULT_WA_POST)
    const cm = ns.reminder_custom_minutes
    setNotifCustomReminderHours(
      typeof cm === "number" && cm > 0 && Number.isFinite(cm) ? String(Math.round(cm / 60)) : ""
    )
    setNotifMetaTplConfirm(ns.whatsapp_meta_template_confirmation?.trim() ?? "")
    setNotifMetaTplReminder(ns.whatsapp_meta_template_reminder?.trim() ?? "")
    setNotifMetaTplPost(ns.whatsapp_meta_template_post_service?.trim() ?? "")
  }, [
    barbershop?.id,
    barbershop?.updated_at,
    JSON.stringify(barbershop?.settings?.notification_settings ?? null),
  ])

  const toggleReminderOffset = (minutes: number) => {
    setNotifReminderOffsets((prev) => {
      const next = prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes]
      return [...new Set(next)]
        .filter((m) => ALLOWED_REMINDER_MINUTES.has(m))
        .sort((a, b) => a - b)
    })
  }

  const loadBarbers = useCallback(async () => {
    setBarbersLoading(true)
    setEquipeError(null)
    try {
      const r = await fetch("/api/barbers", { credentials: "include" })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setEquipeError(typeof j.error === "string" ? j.error : "Erro ao carregar equipe")
        setBarbers([])
        return
      }
      const data = await r.json()
      setBarbers(Array.isArray(data) ? data : [])
    } catch {
      setEquipeError("Erro de rede ao carregar equipe")
      setBarbers([])
    } finally {
      setBarbersLoading(false)
    }
  }, [])

  const loadServices = useCallback(async () => {
    setServicosLoading(true)
    setServicosError(null)
    try {
      const r = await fetch("/api/services", { credentials: "include" })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setServicosError(typeof j.error === "string" ? j.error : "Erro ao carregar serviços")
        setListaServicos([])
        return
      }
      const data = await r.json()
      setListaServicos(Array.isArray(data) ? data : [])
    } catch {
      setServicosError("Erro de rede")
      setListaServicos([])
    } finally {
      setServicosLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBarbers()
  }, [loadBarbers])

  useEffect(() => {
    if (!barbershopLoading && barbershop) loadServices()
  }, [barbershopLoading, barbershop?.id, loadServices])

  const loadWhatsapp = useCallback(async () => {
    setWaLoading(true)
    setWaError(null)
    try {
      const r = await fetch("/api/whatsapp", { credentials: "include" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        if (r.status === 403) {
          setWaPlanBlocked(true)
          setWaError(null)
          setWaHasApiToken(false)
          return
        }
        setWaPlanBlocked(false)
        setWaError(typeof j.error === "string" ? j.error : "Não foi possível carregar")
        setWaPhone("")
        setWaGraphId("")
        setWaHasApiToken(false)
        setWaProvider("meta")
        return
      }
      setWaPlanBlocked(false)
      if (j && typeof j.phone_number === "string") {
        setWaPhone(j.phone_number)
        setWaGraphId(typeof j.graph_phone_number_id === "string" ? j.graph_phone_number_id : "")
        setWaProvider(typeof j.api_provider === "string" && j.api_provider ? j.api_provider : "meta")
        setWaHasApiToken(j.has_api_token === true)
        setWaToken("")
        setWaClearToken(false)
      } else {
        setWaPhone("")
        setWaGraphId("")
        setWaProvider("meta")
        setWaHasApiToken(false)
        setWaToken("")
        setWaClearToken(false)
      }
    } catch {
      setWaError("Erro de rede")
    } finally {
      setWaLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!barbershopLoading && barbershop) void loadWhatsapp()
  }, [barbershopLoading, barbershop?.id, loadWhatsapp])

  const linkAgendamento =
    origin && barbershop?.slug ? `${origin}/b/${barbershop.slug}` : barbershop?.slug ? `/b/${barbershop.slug}` : "—"

  const waDigitsOnly = waPhone.replace(/\D/g, "")
  const waApiConnected =
    Boolean(whatsappIntegrationFeature) &&
    waHasApiToken &&
    waDigitsOnly.length >= 10 &&
    (waProvider === "twilio" ? true : Boolean(waGraphId.trim()))
  const fallbackWaMessage = renderNotificationTemplate(
    notifWaConfirmTpl.trim() || DEFAULT_WA_CONFIRM,
    {
      nome_cliente: "Cliente",
      data: "01/01/2026",
      horario: "10:00",
      servico: "Serviço",
      barbearia: barbershop?.name ?? "Barbearia",
    }
  )
  const fallbackWhatsappUrl =
    waDigitsOnly.length >= 10
      ? `https://wa.me/${waDigitsOnly}?text=${encodeURIComponent(fallbackWaMessage)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(fallbackWaMessage)}`

  /** Mesmo URL do card: uma vez no texto, para colar no WhatsApp (agendar + PWA pelo mesmo link). */
  const textoMensagemClienteComLinks =
    origin && barbershop?.slug
      ? `Agende com a gente pelo mesmo link (também serve para colocar o app na tela inicial no celular):\n${origin}/b/${barbershop.slug}\n\nNo Android use Chrome; no iPhone, Safari — abra o link e use “Adicionar à tela de início”.`
      : ""

  const copiarLink = () => {
    const o = typeof window !== "undefined" ? window.location.origin : origin
    const full = o && barbershop?.slug ? `${o}/b/${barbershop.slug}` : ""
    if (full) void navigator.clipboard.writeText(full)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
  }

  const copiarMensagemCliente = () => {
    if (textoMensagemClienteComLinks) {
      void navigator.clipboard.writeText(textoMensagemClienteComLinks)
    }
    setMsgClienteCopiada(true)
    setTimeout(() => setMsgClienteCopiada(false), 2000)
  }

  const compartilharLink = async () => {
    const o = typeof window !== "undefined" ? window.location.origin : origin
    const full = o && barbershop?.slug ? `${o}/b/${barbershop.slug}` : ""
    if (!full) return
    try {
      const nav = typeof navigator !== "undefined" ? navigator : undefined
      if (nav && "share" in nav && typeof nav.share === "function") {
        await nav.share({
          title: `Agendamento - ${barbershop?.name ?? "Barbearia"}`,
          text: "Um link para agendar e instalar o app no celular:",
          url: full,
        })
      } else if (nav?.clipboard) {
        await nav.clipboard.writeText(full)
      }
      setLinkCompartilhado(true)
      setTimeout(() => setLinkCompartilhado(false), 2000)
    } catch {
      // Usuário pode cancelar o compartilhamento.
    }
  }

  const handleSave = async () => {
    if (!barbershop) return
    setIsSaving(true)
    setSaveError(null)
    setSaveOk(false)
    try {
      const opening_hours = openingHoursToSettings(horarios as Record<string, HorarioDiaUi>)
      const r = await fetch("/api/barbershops", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: barbearia.nome.trim(),
          email: barbearia.email.trim(),
          phone: barbearia.telefone.trim() || null,
          settings: {
            address: barbearia.endereco.trim() || undefined,
            city: barbearia.cidade.trim() || undefined,
            state: barbearia.estado.trim() || undefined,
            cep: barbearia.cep.trim() || undefined,
            opening_hours,
          },
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setSaveError(typeof j.error === "string" ? j.error : "Erro ao salvar")
        return
      }
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 3000)
      await refetch()
    } catch {
      setSaveError("Erro de rede ao salvar")
    } finally {
      setIsSaving(false)
    }
  }

  const toggleDia = (dia: string) => {
    setHorarios((prev) => ({
      ...prev,
      [dia]: { ...prev[dia as keyof typeof prev], ativo: !prev[dia as keyof typeof prev].ativo },
    }))
  }

  const handleAddService = async () => {
    if (!newServNome.trim()) return
    const price = Number(newServPreco)
    if (!Number.isFinite(price) || price < 0) {
      setServicosError("Preço inválido")
      return
    }
    setServicoBusy(true)
    setServicosError(null)
    try {
      const r = await fetch("/api/services", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newServNome.trim(),
          price,
          duration: Math.max(1, Number(newServDuracao) || 30),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setServicosError(typeof j.error === "string" ? j.error : "Erro ao criar")
        return
      }
      setAddServOpen(false)
      setNewServNome("")
      setNewServDuracao("30")
      setNewServPreco("")
      await loadServices()
    } catch {
      setServicosError("Erro de rede")
    } finally {
      setServicoBusy(false)
    }
  }

  const openEditServ = (s: Service) => {
    setEditingServ(s)
    setEditServNome(s.name)
    setEditServDuracao(String(s.duration))
    setEditServPreco(String(s.price))
    setEditServAtivo(s.active)
    setEditServOpen(true)
  }

  const handleSaveServ = async () => {
    if (!editingServ || !editServNome.trim()) return
    const price = Number(editServPreco)
    const duration = Math.max(1, Number(editServDuracao) || 30)
    if (!Number.isFinite(price) || price < 0) {
      setServicosError("Preço inválido")
      return
    }
    setServicoBusy(true)
    setServicosError(null)
    try {
      const r = await fetch(`/api/services/${editingServ.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editServNome.trim(),
          price,
          duration,
          active: editServAtivo,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setServicosError(typeof j.error === "string" ? j.error : "Erro ao salvar")
        return
      }
      setEditServOpen(false)
      setEditingServ(null)
      await loadServices()
    } catch {
      setServicosError("Erro de rede")
    } finally {
      setServicoBusy(false)
    }
  }

  const handleDeleteServ = async (s: Service) => {
    if (!confirm(`Excluir o serviço "${s.name}"?`)) return
    setServicoBusy(true)
    setServicosError(null)
    try {
      const r = await fetch(`/api/services/${s.id}`, { method: "DELETE", credentials: "include" })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setServicosError(typeof j.error === "string" ? j.error : "Erro ao excluir")
        return
      }
      await loadServices()
    } catch {
      setServicosError("Erro de rede")
    } finally {
      setServicoBusy(false)
    }
  }

  const handleSaveWhatsapp = async () => {
    if (!waPhone.trim()) {
      setWaError("Informe o número")
      return
    }
    setWaBusy(true)
    setWaError(null)
    try {
      const body: Record<string, unknown> = {
        phone_number: waPhone.trim(),
        graph_phone_number_id: waGraphId.trim() || null,
        api_provider: waProvider,
      }
      if (waClearToken) {
        body.clear_api_token = true
      } else if (waToken.trim()) {
        body.api_token = waToken.trim()
      }
      const r = await fetch("/api/whatsapp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setWaError(typeof j.error === "string" ? j.error : "Erro ao salvar")
        return
      }
      setWaToken("")
      setWaClearToken(false)
      await loadWhatsapp()
    } catch {
      setWaError("Erro de rede")
    } finally {
      setWaBusy(false)
    }
  }

  const handleWaDisconnect = async () => {
    if (!confirm("Desconectar a API do WhatsApp? O número cadastrado permanece; tokens serão removidos.")) return
    setWaBusy(true)
    setWaError(null)
    try {
      const r = await fetch("/api/whatsapp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disconnect: true }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setWaError(typeof j.error === "string" ? j.error : "Erro ao desconectar")
        return
      }
      setWaGraphId("")
      setWaToken("")
      setWaClearToken(false)
      await loadWhatsapp()
    } catch {
      setWaError("Erro de rede")
    } finally {
      setWaBusy(false)
    }
  }

  const handleSaveNotificacoes = async () => {
    if (!barbershop) return
    setNotifBusy(true)
    setNotifError(null)
    setNotifOk(false)
    try {
      const offsets = notifReminderOffsets.filter((m) => ALLOWED_REMINDER_MINUTES.has(m))
      const rawH = notifCustomReminderHours.trim().replace(",", ".")
      const hours = rawH === "" ? NaN : Number(rawH)
      let reminder_custom_minutes: number | null = null
      if (Number.isFinite(hours) && hours > 0) {
        const m = Math.round(hours * 60)
        if (m >= 5 && m <= 7 * 24 * 60) reminder_custom_minutes = m
      }
      if (offsets.length === 0 && reminder_custom_minutes == null) {
        setNotifError("Escolha pelo menos um horário para enviar o lembrete antes do serviço.")
        setNotifBusy(false)
        return
      }
      if (notifWa && !waPhone.replace(/\D/g, "").trim()) {
        setNotifError("Para ativar lembrete por WhatsApp, cadastre o número da integração abaixo.")
        setNotifBusy(false)
        return
      }
      const r = await fetch("/api/barbershops", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            notification_settings: {
              reminder_offsets_minutes: offsets,
              reminder_custom_minutes,
              notify_app: notifApp,
              notify_whatsapp: notifWa,
              app_reminder_template: notifAppTpl.trim() || DEFAULT_APP_REMINDER,
              whatsapp_reminder_template: notifWaTpl.trim() || DEFAULT_WA_REMINDER,
              whatsapp_confirmation_template: notifWaConfirmTpl.trim() || DEFAULT_WA_CONFIRM,
              whatsapp_post_service_template: notifWaPostTpl.trim() || DEFAULT_WA_POST,
              whatsapp_meta_template_confirmation: notifMetaTplConfirm.trim(),
              whatsapp_meta_template_reminder: notifMetaTplReminder.trim(),
              whatsapp_meta_template_post_service: notifMetaTplPost.trim(),
            },
          },
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setNotifError(typeof j.error === "string" ? j.error : "Erro ao salvar notificações")
        return
      }
      setNotifOk(true)
      setTimeout(() => setNotifOk(false), 3000)
      await refetch()
    } catch {
      setNotifError("Erro de rede ao salvar")
    } finally {
      setNotifBusy(false)
    }
  }

  const handleCreateUnit = async () => {
    if (!newUnitName.trim()) return
    setUnitBusy(true)
    setUnitError(null)
    try {
      const r = await fetch("/api/units", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUnitName.trim(),
          phone: newUnitPhone.trim() || null,
          address: newUnitAddress.trim() || null,
          city: newUnitCity.trim() || null,
          state: newUnitState.trim() || null,
          cep: newUnitCep.trim() || null,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setUnitError(typeof j.error === "string" ? j.error : "Erro ao criar unidade")
        return
      }
      setNewUnitName("")
      setNewUnitPhone("")
      setNewUnitAddress("")
      setNewUnitCity("")
      setNewUnitState("")
      setNewUnitCep("")
      await refetchUnits()
    } catch {
      setUnitError("Erro de rede ao criar unidade")
    } finally {
      setUnitBusy(false)
    }
  }

  const openEditUnit = (unit: BarbershopUnit) => {
    setEditingUnit(unit)
    setEditUnitName(unit.name)
    setEditUnitPhone(unit.phone ?? "")
    setEditUnitAddress(unit.address ?? "")
    setEditUnitCity(unit.city ?? "")
    setEditUnitState(unit.state ?? "")
    setEditUnitCep(unit.cep ?? "")
    setUnitEditOpen(true)
  }

  const handleSaveEditUnit = async () => {
    if (!editingUnit || !editUnitName.trim()) return
    setUnitBusy(true)
    setUnitError(null)
    try {
      const r = await fetch(`/api/units/${editingUnit.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editUnitName.trim(),
          phone: editUnitPhone.trim() || null,
          address: editUnitAddress.trim() || null,
          city: editUnitCity.trim() || null,
          state: editUnitState.trim() || null,
          cep: editUnitCep.trim() || null,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setUnitError(typeof j.error === "string" ? j.error : "Erro ao salvar unidade")
        return
      }
      setUnitEditOpen(false)
      setEditingUnit(null)
      await refetchUnits()
    } catch {
      setUnitError("Erro de rede ao salvar unidade")
    } finally {
      setUnitBusy(false)
    }
  }

  const handleToggleUnit = async (unit: BarbershopUnit) => {
    setUnitBusy(true)
    setUnitError(null)
    try {
      const r = await fetch(`/api/units/${unit.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !unit.active }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setUnitError(typeof j.error === "string" ? j.error : "Erro ao atualizar unidade")
        return
      }
      await refetchUnits()
    } catch {
      setUnitError("Erro de rede ao atualizar unidade")
    } finally {
      setUnitBusy(false)
    }
  }

  const openEdit = (b: Barber) => {
    setEditing(b)
    setEditName(b.name)
    setEditPhone(b.phone ?? "")
    setEditEmail(b.email ?? "")
    setEditCpf(formatCpfDisplay(b.cpf ?? ""))
    setEditPhotoDraft(b.photo_url ?? null)
    setEditCommission(String(Number(b.commission) || 0))
    setEditActive(b.active)
    setEditOpen(true)
  }

  const gerarLinkConvite = async () => {
    setInviteBusy(true)
    setInviteError(null)
    setInviteCopied(false)
    try {
      const r = await fetch("/api/barbers/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ days_valid: 7 }),
      })
      const j = (await r.json().catch(() => ({}))) as {
        error?: string
        token?: string
        expires_at?: string
      }
      if (!r.ok || !j.token) {
        setInviteError(typeof j.error === "string" ? j.error : "Não foi possível gerar o link")
        return
      }
      const base = origin || (typeof window !== "undefined" ? window.location.origin : "")
      setInviteUrl(`${base}/convite/barbeiro/${j.token}`)
      setInviteExpiry(j.expires_at ?? null)
    } catch {
      setInviteError("Erro de rede")
    } finally {
      setInviteBusy(false)
    }
  }

  const handleAddBarber = async () => {
    if (!newName.trim()) return
    setEquipeBusy(true)
    setEquipeError(null)
    try {
      const body: { name: string; phone?: string; commission?: number } = {
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
      }
      if (commissionFeature) {
        const c = Math.min(100, Math.max(0, Number(newCommission)))
        if (!Number.isFinite(c)) {
          setEquipeError("Comissão inválida (use 0 a 100).")
          setEquipeBusy(false)
          return
        }
        body.commission = c
      }
      const r = await fetch("/api/barbers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setEquipeError(typeof j.error === "string" ? j.error : "Não foi possível adicionar")
        setEquipeBusy(false)
        return
      }
      setAddOpen(false)
      setNewName("")
      setNewPhone("")
      setNewCommission("50")
      await loadBarbers()
    } catch {
      setEquipeError("Erro de rede")
    } finally {
      setEquipeBusy(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return
    setEquipeBusy(true)
    setEquipeError(null)
    try {
      const patch: Partial<
        Pick<Barber, "name" | "phone" | "email" | "cpf" | "photo_url" | "active" | "commission">
      > = {
        name: editName.trim(),
        phone: editPhone.trim() || null,
        email: editEmail.trim() || null,
        cpf: editCpf.trim() || null,
        photo_url: editPhotoDraft,
        active: editActive,
      }
      if (commissionFeature) {
        const c = Math.min(100, Math.max(0, Number(editCommission)))
        if (!Number.isFinite(c)) {
          setEquipeError("Comissão inválida (use 0 a 100).")
          setEquipeBusy(false)
          return
        }
        patch.commission = c
      }
      const r = await fetch(`/api/barbers/${editing.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setEquipeError(typeof j.error === "string" ? j.error : "Não foi possível salvar")
        setEquipeBusy(false)
        return
      }
      setEditOpen(false)
      setEditing(null)
      await loadBarbers()
    } catch {
      setEquipeError("Erro de rede")
    } finally {
      setEquipeBusy(false)
    }
  }

  const handleDeleteBarber = async (b: Barber) => {
    if (!confirm(`Remover ${b.name} da equipe?`)) return
    setEquipeBusy(true)
    setEquipeError(null)
    try {
      const r = await fetch(`/api/barbers/${b.id}`, { method: "DELETE", credentials: "include" })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setEquipeError(typeof j.error === "string" ? j.error : "Erro ao remover")
        setEquipeBusy(false)
        return
      }
      await loadBarbers()
    } catch {
      setEquipeError("Erro de rede")
    } finally {
      setEquipeBusy(false)
    }
  }

  const toggleBarberActive = async (b: Barber) => {
    setEquipeBusy(true)
    setEquipeError(null)
    try {
      const r = await fetch(`/api/barbers/${b.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !b.active }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setEquipeError(typeof j.error === "string" ? j.error : "Erro ao atualizar")
        setEquipeBusy(false)
        return
      }
      await loadBarbers()
    } catch {
      setEquipeError("Erro de rede")
    } finally {
      setEquipeBusy(false)
    }
  }

  const managedByBilling =
    barbershop?.role !== "super_admin" && barbershop?.is_test !== true
  const subscriptionCanceled = subscription?.status === "canceled"
  const planCards: SubscriptionPlan[] = ["basic", "pro", "premium"]
  const normalizedShopName = (barbershop?.name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
  const namedFullAccessAccount =
    normalizedShopName === "auto cortes" || normalizedShopName === "bsb thiago lins"

  const handleChoosePlan = async (targetPlan: SubscriptionPlan) => {
    setSubscriptionBusy(true)
    setSubscriptionError(null)
    setSubscriptionOk(null)
    try {
      const r = await fetch("/api/subscriptions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setSubscriptionError(typeof j.error === "string" ? j.error : "Não foi possível atualizar o plano")
        return
      }
      setSubscriptionOk(`Plano ${PLAN_LABELS[targetPlan]} ativado com sucesso.`)
      await refetch()
    } catch {
      setSubscriptionError("Erro de rede ao atualizar o plano.")
    } finally {
      setSubscriptionBusy(false)
    }
  }

  const handleCancelPlan = async () => {
    if (!confirm("Tem certeza que deseja cancelar o plano?")) return
    setSubscriptionBusy(true)
    setSubscriptionError(null)
    setSubscriptionOk(null)
    try {
      const r = await fetch("/api/subscriptions", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setSubscriptionError(typeof j.error === "string" ? j.error : "Não foi possível cancelar o plano")
        return
      }
      setSubscriptionOk("Plano cancelado com sucesso.")
      await refetch()
    } catch {
      setSubscriptionError("Erro de rede ao cancelar plano.")
    } finally {
      setSubscriptionBusy(false)
    }
  }

  const handleReactivatePlan = async () => {
    setSubscriptionBusy(true)
    setSubscriptionError(null)
    setSubscriptionOk(null)
    try {
      const r = await fetch("/api/subscriptions", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setSubscriptionError(typeof j.error === "string" ? j.error : "Não foi possível reativar o plano")
        return
      }
      setSubscriptionOk("Plano reativado com sucesso.")
      await refetch()
    } catch {
      setSubscriptionError("Erro de rede ao reativar plano.")
    } finally {
      setSubscriptionBusy(false)
    }
  }

  if (barbershopLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        Carregando configurações…
      </div>
    )
  }

  if (!barbershop) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <p className="text-muted-foreground">
          {barbershopError ??
            "Não foi possível carregar a barbearia. Verifique sua conexão ou faça login novamente."}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
            className="border-border"
          >
            Tentar novamente
          </Button>
          <Button type="button" asChild className="bg-primary text-primary-foreground">
            <Link href="/login">Ir para o login</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie dados da barbearia, horários, serviços e integrações</p>
        </div>
        <Button
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Salvando..." : "Salvar dados e horários"}
        </Button>
      </div>

      {saveError && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {saveError}
        </div>
      )}
      {saveOk && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-sm">
          Dados e horários salvos com sucesso.
        </div>
      )}

      <Card className="bg-gradient-to-r from-primary/20 to-primary/5 border-primary/30">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <LinkIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-1">Seu Link de Agendamento</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Um único link: o cliente agenda pelo navegador e, no celular, pode usar o mesmo endereço para fixar o
                app na tela inicial (Chrome no Android, Safari no iPhone).
              </p>
              <div className="flex flex-col sm:flex-row sm:items-stretch gap-2 p-3 bg-background/50 rounded-lg border border-border">
                <span className="text-primary font-medium flex-1 truncate min-w-0 py-2 sm:py-0 sm:flex sm:items-center">
                  {linkAgendamento}
                </span>
                <div className="flex flex-wrap gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copiarLink}
                    className="border-primary/30 hover:bg-primary/10"
                  >
                    {linkCopiado ? (
                      <>
                        <Check className="w-4 h-4 mr-1 text-green-500" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copiar link
                      </>
                    )}
                  </Button>
                  {textoMensagemClienteComLinks ? (
                    <Button size="sm" variant="secondary" className="border border-border" onClick={copiarMensagemCliente}>
                      {msgClienteCopiada ? (
                        <>
                          <Check className="w-4 h-4 mr-1 text-green-500" />
                          Mensagem copiada!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          Copiar mensagem (WhatsApp)
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
              {textoMensagemClienteComLinks ? (
                <p className="text-xs text-muted-foreground mt-2">
                  O link acima é o mesmo que vai na mensagem — não há outro endereço para o cliente.
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-border" type="button" disabled>
                <QrCode className="w-4 h-4 mr-2" />
                QR Code
              </Button>
              <Button variant="outline" className="border-border" type="button" onClick={() => void compartilharLink()}>
                {linkCompartilhado ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Share2 className="w-4 h-4 mr-2" />}
                {linkCompartilhado ? "Compartilhado!" : "Compartilhar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="barbearia" className="space-y-6">
        <TabsList className="bg-secondary/50 border border-border flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="barbearia" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Store className="w-4 h-4 mr-2" />
            Barbearia
          </TabsTrigger>
          <TabsTrigger value="horarios" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Clock className="w-4 h-4 mr-2" />
            Horários
          </TabsTrigger>
          <TabsTrigger value="servicos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Scissors className="w-4 h-4 mr-2" />
            Serviços
          </TabsTrigger>
          <TabsTrigger value="equipe" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4 mr-2" />
            Equipe
          </TabsTrigger>
          <TabsTrigger value="plano" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Shield className="w-4 h-4 mr-2" />
            Plano &amp; conta
          </TabsTrigger>
          <TabsTrigger value="unidades" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Building2 className="w-4 h-4 mr-2" />
            Unidades
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Bell className="w-4 h-4 mr-2" />
            Notificações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="barbearia">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Informações da Barbearia</CardTitle>
              <CardDescription className="text-muted-foreground">
                Dados salvos no sistema (nome, e-mail de login, telefone e endereço)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="max-w-xl">
                <Field>
                  <FieldLabel htmlFor="nome">Nome da Barbearia</FieldLabel>
                  <Input
                    id="nome"
                    value={barbearia.nome}
                    onChange={(e) => setBarbearia({ ...barbearia, nome: e.target.value })}
                    className="bg-input border-border text-foreground"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">E-mail da conta</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    value={barbearia.email}
                    onChange={(e) => setBarbearia({ ...barbearia, email: e.target.value })}
                    className="bg-input border-border text-foreground"
                  />
                </Field>
                <Field>
                  <FieldLabel>Slug público (somente leitura)</FieldLabel>
                  <Input
                    readOnly
                    value={barbershop.slug}
                    className="bg-muted/50 border-border text-muted-foreground"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="telefone">Telefone / WhatsApp</FieldLabel>
                  <Input
                    id="telefone"
                    value={barbearia.telefone}
                    onChange={(e) => setBarbearia({ ...barbearia, telefone: e.target.value })}
                    className="bg-input border-border text-foreground"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="endereco">Endereço</FieldLabel>
                  <Input
                    id="endereco"
                    value={barbearia.endereco}
                    onChange={(e) => setBarbearia({ ...barbearia, endereco: e.target.value })}
                    className="bg-input border-border text-foreground"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="cidade">Cidade</FieldLabel>
                    <Input
                      id="cidade"
                      value={barbearia.cidade}
                      onChange={(e) => setBarbearia({ ...barbearia, cidade: e.target.value })}
                      className="bg-input border-border text-foreground"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="estado">Estado</FieldLabel>
                    <Input
                      id="estado"
                      value={barbearia.estado}
                      onChange={(e) => setBarbearia({ ...barbearia, estado: e.target.value })}
                      className="bg-input border-border text-foreground"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="cep">CEP</FieldLabel>
                  <Input
                    id="cep"
                    value={barbearia.cep}
                    onChange={(e) => setBarbearia({ ...barbearia, cep: e.target.value })}
                    className="bg-input border-border text-foreground max-w-[200px]"
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="horarios">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Horário de Funcionamento</CardTitle>
              <CardDescription className="text-muted-foreground">
                Defina os dias e horários de atendimento (salvos com &quot;Salvar dados e horários&quot;)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {diasSemana.map((dia) => {
                  const horario = horarios[dia.key]
                  return (
                    <div
                      key={dia.key}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                        horario.ativo ? "border-border bg-secondary/30" : "border-border/50 bg-secondary/10"
                      }`}
                    >
                      <Switch checked={horario.ativo} onCheckedChange={() => toggleDia(dia.key)} />
                      <span
                        className={`w-32 font-medium ${horario.ativo ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {dia.label}
                      </span>
                      {horario.ativo ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={horario.abertura}
                            onChange={(e) =>
                              setHorarios((prev) => ({
                                ...prev,
                                [dia.key]: { ...prev[dia.key], abertura: e.target.value },
                              }))
                            }
                            className="w-32 bg-input border-border text-foreground"
                          />
                          <span className="text-muted-foreground">até</span>
                          <Input
                            type="time"
                            value={horario.fechamento}
                            onChange={(e) =>
                              setHorarios((prev) => ({
                                ...prev,
                                [dia.key]: { ...prev[dia.key], fechamento: e.target.value },
                              }))
                            }
                            className="w-32 bg-input border-border text-foreground"
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Fechado</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="servicos">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-foreground">Serviços</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Serviços reais da agenda (sincronizados com o banco de dados)
                </CardDescription>
              </div>
              <Dialog open={addServOpen} onOpenChange={setAddServOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Serviço
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Adicionar Serviço</DialogTitle>
                  </DialogHeader>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Nome</FieldLabel>
                      <Input
                        className="bg-input border-border text-foreground"
                        value={newServNome}
                        onChange={(e) => setNewServNome(e.target.value)}
                        placeholder="Ex: Corte"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel>Duração (min)</FieldLabel>
                        <Input
                          type="number"
                          min={1}
                          className="bg-input border-border text-foreground"
                          value={newServDuracao}
                          onChange={(e) => setNewServDuracao(e.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Preço (R$)</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          className="bg-input border-border text-foreground"
                          value={newServPreco}
                          onChange={(e) => setNewServPreco(e.target.value)}
                        />
                      </Field>
                    </div>
                    <Button
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={servicoBusy}
                      onClick={() => void handleAddService()}
                    >
                      {servicoBusy ? "Salvando…" : "Adicionar"}
                    </Button>
                  </FieldGroup>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {servicosError && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {servicosError}
                </div>
              )}
              {servicosLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Carregando serviços…</p>
              ) : listaServicos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum serviço cadastrado.</p>
              ) : (
                <div className="space-y-3">
                  {listaServicos.map((servico) => (
                    <div
                      key={servico.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                        servico.active ? "border-border bg-secondary/30" : "border-border/50 bg-secondary/10"
                      }`}
                    >
                      <Switch
                        checked={servico.active}
                        disabled={servicoBusy}
                        onCheckedChange={async (on) => {
                          setServicoBusy(true)
                          try {
                            await fetch(`/api/services/${servico.id}`, {
                              method: "PATCH",
                              credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ active: on }),
                            })
                            await loadServices()
                          } finally {
                            setServicoBusy(false)
                          }
                        }}
                      />
                      <div className="flex-1">
                        <p
                          className={`font-medium ${servico.active ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {servico.name}
                        </p>
                        <p className="text-sm text-muted-foreground">{servico.duration} minutos</p>
                      </div>
                      <span className="text-lg font-semibold text-primary">R${Number(servico.price).toFixed(2)}</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          disabled={servicoBusy}
                          onClick={() => openEditServ(servico)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          disabled={servicoBusy}
                          onClick={() => void handleDeleteServ(servico)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={editServOpen} onOpenChange={setEditServOpen}>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Editar serviço</DialogTitle>
              </DialogHeader>
              {editingServ && (
                <FieldGroup>
                  <Field>
                    <FieldLabel>Nome</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      value={editServNome}
                      onChange={(e) => setEditServNome(e.target.value)}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>Duração (min)</FieldLabel>
                      <Input
                        type="number"
                        min={1}
                        className="bg-input border-border text-foreground"
                        value={editServDuracao}
                        onChange={(e) => setEditServDuracao(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Preço (R$)</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        className="bg-input border-border text-foreground"
                        value={editServPreco}
                        onChange={(e) => setEditServPreco(e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={editServAtivo} onCheckedChange={setEditServAtivo} id="serv-ativo" />
                    <FieldLabel htmlFor="serv-ativo" className="cursor-pointer">
                      Ativo
                    </FieldLabel>
                  </div>
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={servicoBusy}
                    onClick={() => void handleSaveServ()}
                  >
                    {servicoBusy ? "Salvando…" : "Salvar"}
                  </Button>
                </FieldGroup>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="equipe">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-foreground">Equipe</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Profissionais da barbearia. Comissão (% sobre o valor do atendimento) nos planos{" "}
                  <strong className="text-foreground">Pro</strong> e <strong className="text-foreground">Premium</strong>{" "}
                  (e para conta <strong className="text-foreground">Super Admin</strong>).
                </CardDescription>
                {!commissionFeature && (
                  <p className="text-sm text-amber-600/90 dark:text-amber-400/90 mt-2">
                    No plano Básico a comissão fica em 0%. Faça upgrade para definir % por barbeiro.
                  </p>
                )}
              </div>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo profissional
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Adicionar profissional</DialogTitle>
                  </DialogHeader>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Nome</FieldLabel>
                      <Input
                        className="bg-input border-border text-foreground"
                        placeholder="Nome do barbeiro"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Telefone (opcional)</FieldLabel>
                      <Input
                        className="bg-input border-border text-foreground"
                        placeholder="(11) 99999-9999"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                      />
                    </Field>
                    {commissionFeature && (
                      <Field>
                        <FieldLabel>Comissão (%)</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          className="bg-input border-border text-foreground"
                          placeholder="50"
                          value={newCommission}
                          onChange={(e) => setNewCommission(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Porcentagem sobre o valor do serviço (0 a 100).</p>
                      </Field>
                    )}
                    <Button
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={equipeBusy || !newName.trim()}
                      onClick={() => void handleAddBarber()}
                    >
                      {equipeBusy ? "Salvando…" : "Adicionar"}
                    </Button>
                  </FieldGroup>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
                <div className="flex items-start gap-3">
                  <UserPlus className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Convidar profissional por link</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Gere um link único e envie por WhatsApp. O profissional preenche nome, e-mail, telefone, CPF e foto —
                      válido por 7 dias ou até ser usado.
                    </p>
                    {inviteError ? (
                      <p className="text-xs text-destructive mt-2">{inviteError}</p>
                    ) : null}
                    {inviteUrl ? (
                      <div className="mt-3 space-y-2">
                        <Input readOnly value={inviteUrl} className="text-xs bg-background border-border font-mono" />
                        {inviteExpiry ? (
                          <p className="text-xs text-muted-foreground">
                            Expira em {new Date(inviteExpiry).toLocaleString("pt-BR")}
                          </p>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-border"
                          disabled={inviteBusy}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(inviteUrl)
                              setInviteCopied(true)
                              setTimeout(() => setInviteCopied(false), 2000)
                            } catch {
                              setInviteError("Não foi possível copiar")
                            }
                          }}
                        >
                          {inviteCopied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                          {inviteCopied ? "Copiado" : "Copiar link"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  disabled={inviteBusy}
                  onClick={() => void gerarLinkConvite()}
                >
                  {inviteBusy ? "Gerando…" : inviteUrl ? "Gerar novo link" : "Gerar link de convite"}
                </Button>
              </div>

              {equipeError && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {equipeError}
                </div>
              )}
              {barbersLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Carregando equipe…</p>
              ) : barbers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum profissional cadastrado.</p>
              ) : (
                <div className="space-y-3">
                  {barbers.map((prof) => (
                    <div
                      key={prof.id}
                      className={`flex flex-wrap items-center gap-4 p-4 rounded-lg border transition-colors ${
                        prof.active ? "border-border bg-secondary/30" : "border-border/50 bg-secondary/10"
                      }`}
                    >
                      <Switch
                        checked={prof.active}
                        disabled={equipeBusy}
                        onCheckedChange={() => void toggleBarberActive(prof)}
                      />
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="font-semibold text-primary text-sm">
                          {prof.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <p className={`font-medium ${prof.active ? "text-foreground" : "text-muted-foreground"}`}>
                          {prof.name}
                        </p>
                        <div className="text-sm text-muted-foreground space-y-0.5">
                          {prof.phone && <p>{prof.phone}</p>}
                          {prof.email && <p className="truncate">{prof.email}</p>}
                        </div>
                      </div>
                      <div className="text-center min-w-[72px]">
                        <p className="text-lg font-semibold text-primary">
                          {commissionFeature ? `${Number(prof.commission) || 0}%` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">comissão</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          disabled={equipeBusy}
                          onClick={() => openEdit(prof)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          disabled={equipeBusy}
                          onClick={() => void handleDeleteBarber(prof)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={editOpen}
            onOpenChange={(open) => {
              setEditOpen(open)
              if (!open) setEditing(null)
            }}
          >
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Editar profissional</DialogTitle>
              </DialogHeader>
              {editing && (
                <FieldGroup>
                  <Field>
                    <FieldLabel>Nome</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Telefone</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>E-mail</FieldLabel>
                    <Input
                      type="email"
                      className="bg-input border-border text-foreground"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>CPF</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      value={editCpf}
                      onChange={(e) => setEditCpf(formatCpfDisplay(e.target.value))}
                      maxLength={14}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Foto</FieldLabel>
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="bg-input border-border text-foreground cursor-pointer"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        void compressImageToJpegDataUrl(f, 640, 0.8)
                          .then((url) => setEditPhotoDraft(url))
                          .catch(() => setEquipeError("Não foi possível ler a imagem"))
                      }}
                    />
                    {editPhotoDraft ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={editPhotoDraft}
                          alt=""
                          className="mt-2 w-20 h-20 rounded-full object-cover border border-border"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-auto py-1 px-0 text-muted-foreground"
                          onClick={() => setEditPhotoDraft(null)}
                        >
                          Remover foto
                        </Button>
                      </>
                    ) : null}
                  </Field>
                  {commissionFeature && (
                    <Field>
                      <FieldLabel>Comissão (%)</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        className="bg-input border-border text-foreground"
                        value={editCommission}
                        onChange={(e) => setEditCommission(e.target.value)}
                      />
                    </Field>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch checked={editActive} onCheckedChange={setEditActive} id="edit-ativo" />
                    <FieldLabel htmlFor="edit-ativo" className="cursor-pointer">
                      Ativo na agenda
                    </FieldLabel>
                  </div>
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={equipeBusy || !editName.trim()}
                    onClick={() => void handleSaveEdit()}
                  >
                    {equipeBusy ? "Salvando…" : "Salvar alterações"}
                  </Button>
                </FieldGroup>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="plano">
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Plano atual e cobrança</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Aqui você pode contratar, fazer upgrade e cancelar o plano da sua barbearia.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="p-3 rounded-lg border border-border bg-secondary/20">
                  <p className="text-foreground font-medium mb-1">Status atual</p>
                  <p>
                    Plano efetivo:{" "}
                    <strong className="text-primary">
                      {plan ? PLAN_LABELS[plan] : "Sem plano ativo"}
                    </strong>
                    {" • "}
                    Assinatura:{" "}
                    <strong className="text-foreground">
                      {subscription?.status ?? "não encontrada"}
                    </strong>
                  </p>
                  {!managedByBilling && subscription?.plan && (
                    <p className="mt-1">
                      Plano contratado para teste:{" "}
                      <strong className="text-foreground">{PLAN_LABELS[subscription.plan]}</strong>
                    </p>
                  )}
                </div>

                {subscriptionError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {subscriptionError}
                  </div>
                )}
                {subscriptionOk && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-sm">
                    {subscriptionOk}
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-3">
                  {planCards.map((planOption) => {
                    const isCurrent = plan === planOption && subscription?.status !== "canceled"
                    const featuresPreview = PLAN_FEATURES[planOption].slice(0, 4)
                    const actionLabel = isCurrent
                      ? "Plano atual"
                      : managedByBilling
                        ? "Contratar plano"
                        : "Selecionar para teste"
                    return (
                      <div
                        key={planOption}
                        className={`rounded-lg border p-4 ${
                          isCurrent ? "border-primary bg-primary/5" : "border-border bg-secondary/10"
                        }`}
                      >
                        <p className="font-semibold text-foreground">{PLAN_LABELS[planOption]}</p>
                        <p className="text-primary text-lg font-bold mt-1">
                          R$ {PLAN_PRICES[planOption]}/mês
                        </p>
                        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                          {featuresPreview.map((feature) => (
                            <li key={`${planOption}_${feature}`}>- {feature}</li>
                          ))}
                        </ul>
                        <Button
                          type="button"
                          className="w-full mt-3 bg-primary text-primary-foreground hover:bg-primary/90"
                          disabled={subscriptionBusy || isCurrent}
                          onClick={() => void handleChoosePlan(planOption)}
                        >
                          {actionLabel}
                        </Button>
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={subscriptionBusy || subscriptionCanceled || !subscription}
                    onClick={() => void handleCancelPlan()}
                  >
                    Cancelar plano
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border"
                    disabled={subscriptionBusy || !subscriptionCanceled}
                    onClick={() => void handleReactivatePlan()}
                  >
                    Reativar plano atual
                  </Button>
                </div>
                <p>
                  Se sua conta estiver no plano <strong className="text-foreground">Básico</strong>, você pode subir
                  para <strong className="text-foreground">Pro</strong> ou{" "}
                  <strong className="text-foreground">Premium</strong> por aqui.
                </p>
                {!managedByBilling && (
                  <div className="p-3 rounded-lg border border-primary/30 bg-primary/10">
                    {barbershop.role === "super_admin" ? (
                      <div className="space-y-2">
                        <p>
                          <strong className="text-primary">Conta Super Admin</strong>: acesso total liberado (equivalente ao
                          Premium). A gestão global de planos fica na{" "}
                          <Link href="/plataforma" className="text-primary underline underline-offset-2">
                            Plataforma Trim Time
                          </Link>
                          .
                        </p>
                        <p className="text-foreground/90">
                          Recursos liberados nesta conta: serviços, profissionais, agenda, clientes, financeiro,
                          unidades e integrações.
                        </p>
                        {namedFullAccessAccount && (
                          <p className="text-foreground/90">
                            Esta conta está no grupo de acesso total que você citou (Auto.Cortes e BSB Thiago Lins).
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p>
                          <strong className="text-primary">Conta de teste</strong>: acesso total liberado (equivalente ao
                          Premium) sem cobrança.
                        </p>
                        <p className="text-foreground/90">
                          Recursos liberados nesta conta: serviços, profissionais, agenda, clientes, financeiro,
                          unidades e integrações.
                        </p>
                        {namedFullAccessAccount && (
                          <p className="text-foreground/90">
                            Esta conta está no grupo de acesso total que você citou (Auto.Cortes e BSB Thiago Lins).
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Informações de conta</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Contexto sobre tipo de conta e desbloqueios de desenvolvimento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-2xl text-sm text-muted-foreground">
                <div>
                  <p className="text-foreground font-medium mb-1">Tipo de conta da barbearia</p>
                  {barbershop.role === "super_admin" ? (
                    <p>
                      <strong className="text-primary">Super Admin (Trim Time)</strong> — acesso total aos recursos do
                      sistema sem cobrança.
                    </p>
                  ) : (
                    <p>
                      <strong className="text-foreground">Dono da barbearia</strong> — configura equipe, serviços e agenda
                      neste painel.
                    </p>
                  )}
                </div>
                <div className="p-3 rounded-lg border border-border bg-secondary/20">
                  <p className="text-foreground font-medium mb-1">Desenvolvimento</p>
                  <p>
                    No servidor, a variável{" "}
                    <code className="text-xs bg-muted px-1 rounded">TRIMTIME_UNLOCK_ALL_PLAN_FEATURES=true</code> faz
                    todas as barbearias usarem recursos equivalentes ao <strong>Premium</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="unidades">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Unidades da barbearia</CardTitle>
              <CardDescription className="text-muted-foreground space-y-2">
                <span className="block">
                  Cada unidade pode ter <strong className="text-foreground">nome próprio</strong> (muitas vezes igual ao
                  nome da marca) e, se quiser, <strong className="text-foreground">telefone e endereço</strong> diferentes
                  para identificar a loja física.
                </span>
                <span className="block">
                  <strong className="text-foreground">E-mail e WhatsApp</strong> da integração continuam os da conta da
                  barbearia — um único número pode atender todas as unidades. Só faz sentido cadastrar WhatsApp por
                  unidade se cada loja tiver atendimento separado (isso pode ser evoluído depois).
                </span>
                <span className="block">
                  No topo do painel, escolha a unidade para filtrar dashboard e relatórios que usam agendamentos por
                  unidade.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!multiUnitsFeature && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm text-amber-700 dark:text-amber-400">
                  Multiunidade está disponível no plano Premium.
                </div>
              )}
              {unitError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {unitError}
                </div>
              )}

              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-primary"
                    disabled={!barbershop?.name}
                    onClick={() => setNewUnitName(barbershop?.name ?? "")}
                  >
                    Usar nome da barbearia
                  </Button>
                </div>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Nome da unidade</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      placeholder="Ex.: Trim Time — Centro ou mesmo nome da barbearia"
                      value={newUnitName}
                      onChange={(e) => setNewUnitName(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Telefone da unidade (opcional)</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      placeholder="WhatsApp / fixo desta loja"
                      value={newUnitPhone}
                      onChange={(e) => setNewUnitPhone(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Endereço (opcional)</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      placeholder="Rua, número, bairro"
                      value={newUnitAddress}
                      onChange={(e) => setNewUnitAddress(e.target.value)}
                    />
                  </Field>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Field>
                      <FieldLabel>Cidade</FieldLabel>
                      <Input
                        className="bg-input border-border text-foreground"
                        value={newUnitCity}
                        onChange={(e) => setNewUnitCity(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Estado</FieldLabel>
                      <Input
                        className="bg-input border-border text-foreground"
                        value={newUnitState}
                        onChange={(e) => setNewUnitState(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>CEP</FieldLabel>
                      <Input
                        className="bg-input border-border text-foreground"
                        value={newUnitCep}
                        onChange={(e) => setNewUnitCep(e.target.value)}
                      />
                    </Field>
                  </div>
                </FieldGroup>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={unitBusy || !newUnitName.trim() || !multiUnitsFeature}
                    onClick={() => void handleCreateUnit()}
                  >
                    {unitBusy ? "Salvando…" : "Adicionar unidade"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border text-foreground hover:bg-secondary"
                    onClick={() => void changeUnit(null)}
                  >
                    Ver todas unidades
                  </Button>
                </div>
              </div>

              {unitsLoading ? (
                <p className="text-sm text-muted-foreground">Carregando unidades…</p>
              ) : units.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma unidade cadastrada. O sistema está em modo "todas as unidades".
                </p>
              ) : (
                <div className="space-y-3">
                  {units.map((unit) => (
                    <div
                      key={unit.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border bg-secondary/20"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{unit.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {unit.id === selectedUnitId ? "Unidade ativa no painel" : "Unidade disponível"}
                          {" • "}
                          {unit.active ? "Ativa" : "Inativa"}
                        </p>
                        {(unit.phone || unit.address || unit.city) && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-md">
                            {[unit.phone, [unit.address, unit.city, unit.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-border text-foreground hover:bg-secondary"
                          onClick={() => void changeUnit(unit.id)}
                        >
                          Selecionar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-border text-foreground hover:bg-secondary"
                          onClick={() => openEditUnit(unit)}
                          disabled={unitBusy || !multiUnitsFeature}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-border text-foreground hover:bg-secondary"
                          onClick={() => void handleToggleUnit(unit)}
                          disabled={unitBusy || !multiUnitsFeature}
                        >
                          {unit.active ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={unitEditOpen}
            onOpenChange={(open) => {
              setUnitEditOpen(open)
              if (!open) setEditingUnit(null)
            }}
          >
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">Editar unidade</DialogTitle>
              </DialogHeader>
              {editingUnit && (
                <FieldGroup className="py-2">
                  <Field>
                    <FieldLabel>Nome</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      value={editUnitName}
                      onChange={(e) => setEditUnitName(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Telefone (opcional)</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      value={editUnitPhone}
                      onChange={(e) => setEditUnitPhone(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Endereço</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      value={editUnitAddress}
                      onChange={(e) => setEditUnitAddress(e.target.value)}
                    />
                  </Field>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Field>
                      <FieldLabel>Cidade</FieldLabel>
                      <Input
                        className="bg-input border-border text-foreground"
                        value={editUnitCity}
                        onChange={(e) => setEditUnitCity(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Estado</FieldLabel>
                      <Input
                        className="bg-input border-border text-foreground"
                        value={editUnitState}
                        onChange={(e) => setEditUnitState(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>CEP</FieldLabel>
                      <Input
                        className="bg-input border-border text-foreground"
                        value={editUnitCep}
                        onChange={(e) => setEditUnitCep(e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-border"
                      onClick={() => setUnitEditOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 bg-primary text-primary-foreground"
                      disabled={unitBusy || !editUnitName.trim()}
                      onClick={() => void handleSaveEditUnit()}
                    >
                      {unitBusy ? "Salvando…" : "Salvar"}
                    </Button>
                  </div>
                </FieldGroup>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="notificacoes" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Lembretes antes do atendimento</CardTitle>
              <CardDescription className="text-muted-foreground">
                Defina com quanta antecedência o cliente pode ser avisado do horário marcado. O envio automático no
                horário exato depende da fila de notificações do sistema (estrutura pronta para evolução).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-2xl">
              {notifError ? (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {notifError}
                </div>
              ) : null}
              {notifOk ? (
                <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10 text-sm text-green-600">
                  Preferências de notificação salvas.
                </div>
              ) : null}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Enviar lembrete</p>
                <div className="flex flex-col gap-3">
                  {REMINDER_OFFSET_OPTIONS.map((opt) => (
                    <label
                      key={opt.minutes}
                      className="flex items-center gap-3 cursor-pointer text-sm text-foreground"
                    >
                      <Checkbox
                        checked={notifReminderOffsets.includes(opt.minutes)}
                        onCheckedChange={() => toggleReminderOffset(opt.minutes)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Notificação no aplicativo</CardTitle>
              <CardDescription className="text-muted-foreground">
                Mensagem exibida no app / PWA quando o cliente usa o link de agendamento. Um modelo único para todos os
                lembretes por push ou tela no app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-2xl">
              <div className="flex items-center gap-2">
                <Switch checked={notifApp} onCheckedChange={setNotifApp} id="notif-app" />
                <FieldLabel htmlFor="notif-app" className="cursor-pointer">
                  Ativar lembretes no aplicativo
                </FieldLabel>
              </div>
              <Field>
                <FieldLabel>Texto da notificação (app)</FieldLabel>
                <Textarea
                  className="mt-1 bg-input border-border text-foreground min-h-[100px]"
                  value={notifAppTpl}
                  onChange={(e) => setNotifAppTpl(e.target.value)}
                  disabled={!notifApp}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Variáveis: <code className="text-foreground/90">{"{{nome_cliente}}"}</code>,{" "}
                  <code className="text-foreground/90">{"{{data}}"}</code>,{" "}
                  <code className="text-foreground/90">{"{{horario}}"}</code>,{" "}
                  <code className="text-foreground/90">{"{{servico}}"}</code>,{" "}
                  <code className="text-foreground/90">{"{{barbearia}}"}</code>
                </p>
              </Field>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                WhatsApp Business
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Cadastre o número da conta Business. Use o guia das parceiras (Twilio, Zenvia, 360dialog), edite os
                textos e horários abaixo. Envio automático pela API é Premium; modo simples (WhatsApp sem API) funciona em
                qualquer plano.
                {!whatsappIntegrationFeature ? (
                  <span className="block mt-2 text-amber-600 dark:text-amber-400">
                    Plano atual: sem API na nuvem. Faça upgrade para Premium para salvar token e disparo automático; até
                    lá, configure textos aqui e use &quot;Abrir WhatsApp&quot; quando não houver token salvo.
                  </span>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-2xl">
              <Dialog open={waConnectOpen} onOpenChange={setWaConnectOpen}>
                <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Conectar WhatsApp Business</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Para enviar mensagens automáticas para seus clientes, conecte seu WhatsApp Business através de uma
                      das plataformas oficiais.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {WHATSAPP_PARTNER_LINKS.map((p) => (
                      <div
                        key={p.name}
                        className="rounded-lg border border-border bg-muted/30 p-4 space-y-2"
                      >
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                        <Button
                          type="button"
                          variant="secondary"
                          className="border border-border"
                          onClick={() => window.open(p.href, "_blank", "noopener,noreferrer")}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Conectar
                        </Button>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>

              {waError ? (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {waError}
                </div>
              ) : null}
              {waPlanBlocked ? (
                <div className="p-3 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground">
                  Credenciais de API não são carregadas neste plano (403). Você pode preencher os dados abaixo e tentar
                  salvar após upgrade, ou usar só textos + modo simples.
                </div>
              ) : null}

              <Button type="button" variant="secondary" className="border border-border" onClick={() => setWaConnectOpen(true)}>
                Conectar WhatsApp
              </Button>

              {whatsappIntegrationFeature && waApiConnected ? (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-foreground space-y-2">
                  <p>
                    Status: Conectado <span aria-hidden>✅</span>
                  </p>
                  <p className="text-muted-foreground">Número: {waPhone.trim() || "—"}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="border border-border"
                    disabled={waBusy}
                    onClick={() => void handleWaDisconnect()}
                  >
                    {waBusy ? "…" : "Desconectar"}
                  </Button>
                </div>
              ) : null}

              {waLoading ? (
                <p className="text-muted-foreground">Carregando…</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Após configurar na plataforma externa, informe os dados abaixo e salve a conexão.
                  </p>
                  <Field>
                    <FieldLabel>Nome da plataforma</FieldLabel>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground shadow-xs"
                      value={waProvider}
                      onChange={(e) => setWaProvider(e.target.value)}
                    >
                      <option value="twilio">Twilio</option>
                      <option value="zenvia">Zenvia</option>
                      <option value="360dialog">360dialog</option>
                      <option value="meta">Meta (Cloud API direta)</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>Phone Number ID</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground font-mono text-sm"
                      value={waGraphId}
                      onChange={(e) => setWaGraphId(e.target.value)}
                      placeholder={
                        waProvider === "zenvia"
                          ? "ID do remetente no painel Zenvia"
                          : waProvider === "twilio"
                            ? "Opcional para Twilio"
                            : "ID do número (Meta / 360dialog)"
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {waProvider === "twilio"
                        ? "Twilio usa o número Business abaixo como remetente. Este campo é opcional."
                        : waProvider === "zenvia"
                          ? "Obrigatório para Zenvia: identificador do remetente/canal."
                          : "Obrigatório para Meta e 360dialog."}
                    </p>
                  </Field>
                  <Field>
                    <FieldLabel>API Key / Token</FieldLabel>
                    <Input
                      type="password"
                      className="bg-input border-border text-foreground"
                      value={waToken}
                      onChange={(e) => setWaToken(e.target.value)}
                      placeholder={
                        waProvider === "twilio"
                          ? "ACxxxxxxxx|seu_auth_token"
                          : "Deixe em branco para manter o token já salvo"
                      }
                      autoComplete="off"
                    />
                    <label className="flex items-center gap-2 mt-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={waClearToken}
                        onChange={(e) => setWaClearToken(e.target.checked)}
                        className="rounded border-border"
                      />
                      Remover token salvo no próximo envio
                    </label>
                  </Field>
                  <Field>
                    <FieldLabel>Número do WhatsApp</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      value={waPhone}
                      onChange={(e) => setWaPhone(e.target.value)}
                      placeholder="5511999998888"
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="secondary"
                    className="border border-border"
                    disabled={waBusy}
                    onClick={() => void handleSaveWhatsapp()}
                  >
                    {waBusy ? "Salvando…" : "Salvar conexão"}
                  </Button>
                </div>
              )}

              <div className="border-t border-border pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Switch checked={notifWa} onCheckedChange={setNotifWa} id="notif-wa" />
                  <FieldLabel htmlFor="notif-wa" className="cursor-pointer">
                    Incluir lembrete por WhatsApp (quando a API estiver ativa no plano Premium)
                  </FieldLabel>
                </div>
              </div>

              <div className="border-t border-border pt-6 space-y-4">
                <p className="text-sm font-medium text-foreground">TEMPLATES DE MENSAGEM</p>
                <Field>
                  <FieldLabel>Mensagem de confirmação</FieldLabel>
                  <Textarea
                    className="mt-1 bg-input border-border text-foreground min-h-[100px]"
                    value={notifWaConfirmTpl}
                    onChange={(e) => setNotifWaConfirmTpl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Ex.: Olá {"{{nome}}"}, seu horário está confirmado para {"{{data}}"} às {"{{hora}}"}.
                  </p>
                </Field>
                <Field>
                  <FieldLabel>Mensagem de lembrete</FieldLabel>
                  <Textarea
                    className="mt-1 bg-input border-border text-foreground min-h-[100px]"
                    value={notifWaTpl}
                    onChange={(e) => setNotifWaTpl(e.target.value)}
                    disabled={!notifWa}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Ex.: Olá {"{{nome}}"}, lembrando do seu horário amanhã às {"{{hora}}"}. Também: {"{{nome_cliente}}"},{" "}
                    {"{{data}}"}, {"{{horario}}"}, {"{{servico}}"}, {"{{barbearia}}"}.
                  </p>
                </Field>
                <Field>
                  <FieldLabel>Mensagem pós-atendimento</FieldLabel>
                  <Textarea
                    className="mt-1 bg-input border-border text-foreground min-h-[100px]"
                    value={notifWaPostTpl}
                    onChange={(e) => setNotifWaPostTpl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Ex.: Obrigado pela preferência! Esperamos você novamente.
                  </p>
                </Field>
                <div className="space-y-3 pt-2 border-t border-border">
                  <p className="text-xs font-medium text-foreground">Templates oficiais Meta (opcional)</p>
                  <p className="text-xs text-muted-foreground">
                    Nomes aprovados no Gerenciador do WhatsApp; uso em envio por template (evolução da API). Deixe em
                    branco para mensagens de texto livre.
                  </p>
                  <Field>
                    <FieldLabel>Template confirmação (nome Meta)</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground font-mono text-sm"
                      value={notifMetaTplConfirm}
                      onChange={(e) => setNotifMetaTplConfirm(e.target.value)}
                      placeholder="ex.: appointment_confirmed"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Template lembrete (nome Meta)</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground font-mono text-sm"
                      value={notifMetaTplReminder}
                      onChange={(e) => setNotifMetaTplReminder(e.target.value)}
                      placeholder="ex.: appointment_reminder"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Template pós-atendimento (nome Meta)</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground font-mono text-sm"
                      value={notifMetaTplPost}
                      onChange={(e) => setNotifMetaTplPost(e.target.value)}
                      placeholder="ex.: thank_you_visit"
                    />
                  </Field>
                </div>
              </div>

              <div className="border-t border-border pt-6 space-y-3">
                <p className="text-sm font-medium text-foreground">Configuração de horários (lembrete)</p>
                <p className="text-xs text-muted-foreground">
                  Mesma configuração do card &quot;Lembretes antes do atendimento&quot; (push + WhatsApp). Aqui você pode
                  marcar 1 h, 2 h e 1 dia; 30 min só no card acima.
                </p>
                <div className="flex flex-col gap-3">
                  {WA_SECTION_REMINDER_OPTIONS.map((opt) => (
                    <label
                      key={opt.minutes}
                      className="flex items-center gap-3 cursor-pointer text-sm text-foreground"
                    >
                      <Checkbox
                        checked={notifReminderOffsets.includes(opt.minutes)}
                        onCheckedChange={() => toggleReminderOffset(opt.minutes)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <Field>
                  <FieldLabel>Enviar X horas antes (personalizado)</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    className="mt-1 bg-input border-border text-foreground max-w-[200px]"
                    value={notifCustomReminderHours}
                    onChange={(e) => setNotifCustomReminderHours(e.target.value)}
                    placeholder="Ex.: 3"
                  />
                </Field>
              </div>

              {!waHasApiToken ? (
                <div className="border-t border-border pt-6 space-y-3">
                  <p className="text-sm font-medium text-foreground">Modo simples (sem API)</p>
                  <p className="text-xs text-muted-foreground">
                    Gera um link no formato wa.me com o número do WhatsApp acima e o texto da confirmação. Preencha o
                    número (DDI + código, só dígitos) para usar wa.me; sem número, abre só o texto para você escolher o
                    contato.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="border border-border"
                    onClick={() => window.open(fallbackWhatsappUrl, "_blank", "noopener,noreferrer")}
                  >
                    Abrir WhatsApp
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={notifBusy}
              onClick={() => void handleSaveNotificacoes()}
            >
              {notifBusy ? "Salvando…" : "Salvar configurações de notificações"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
