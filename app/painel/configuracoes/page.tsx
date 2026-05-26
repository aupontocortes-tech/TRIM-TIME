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
  RetailProduct,
} from "@/lib/db/types"
import {
  bookingRulesFromSettings,
  bookingRulesToSettings,
  defaultHorariosUi,
  defaultBookingRulesUi,
  openingHoursFromSettings,
  openingHoursToSettings,
  DIAS_SEMANA_KEYS,
  type BlockedRangeUi,
  type BookingRulesUi,
  type HorarioDiaUi,
} from "@/lib/barbershop-settings-ui"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatCpfDisplay } from "@/lib/cpf"
import { publicBookingUrl } from "@/lib/booking-public-url"
import { normalizeGoogleMapsUrl } from "@/lib/google-maps-url"
import { MapsLinkFieldLabel } from "@/components/maps-link-field-label"
import { compressImageToJpegDataUrl } from "@/lib/client-image-compress"
import { MAX_PROFILE_PHOTO_DATA_URL_CHARS } from "@/lib/photo-data-url"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Store,
  Clock,
  Users,
  Scissors,
  ShoppingBag,
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
  Camera,
  Trophy,
  Download,
  MessageSquare,
  CalendarCheck,
  Clock3,
  Heart,
  Zap,
  CheckCircle2,
  ArrowRight,
  Send,
  AlertTriangle,
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
  linkGoogleMaps: string
}

const emptyBarbearia: BarbeariaForm = {
  nome: "",
  email: "",
  telefone: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  linkGoogleMaps: "",
}

const REMINDER_OFFSET_OPTIONS = [
  { minutes: 30, label: "30 minutos antes" },
  { minutes: 60, label: "1 hora antes" },
  { minutes: 120, label: "2 horas antes" },
  { minutes: 1440, label: "1 dia antes" },
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

const CONFIG_TABS_LIST_CLASS =
  "bg-secondary/50 border border-border w-full max-w-none grid grid-cols-2 min-[480px]:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-9 gap-1.5 p-2 rounded-xl h-auto shadow-sm"

const CONFIG_TAB_TRIGGER_CLASS =
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground w-full min-h-[52px] flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-2 py-2.5 text-sm sm:text-base font-semibold leading-tight text-center [&_svg]:!size-5 sm:[&_svg]:!size-6"

const CONFIG_TAB_LABEL_CLASS = "max-w-[9rem] sm:max-w-none"

/** Avisos internos (super admin, conta de teste, variáveis .env): só super_admin ou ambiente local. */
function isLocalDevOrigin(origin: string): boolean {
  if (!origin) return false
  try {
    const { hostname } = new URL(origin)
    return hostname === "localhost" || hostname === "127.0.0.1"
  } catch {
    return false
  }
}

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

  /** Plano efetivo (API) — super admin / teste seguem a assinatura escolhida em Plano. */
  const commissionFeature = plan != null && hasFeature(plan, "barber_commission")
  const multiUnitsFeature = plan != null && hasFeature(plan, "multi_units")
  const whatsappIntegrationFeature = plan != null && hasFeature(plan, "whatsapp_integration")
  const waitlistFeature = plan != null && hasFeature(plan, "waiting_list")

  const [barbearia, setBarbearia] = useState<BarbeariaForm>(emptyBarbearia)
  const [horarios, setHorarios] = useState<
    Record<(typeof DIAS_SEMANA_KEYS)[number], HorarioDiaUi>
  >(() => defaultHorariosUi())
  const [bookingRules, setBookingRules] = useState<BookingRulesUi>(() => defaultBookingRulesUi())
  const [waitlistAcceptMinutes, setWaitlistAcceptMinutes] = useState(15)

  const [listaServicos, setListaServicos] = useState<Service[]>([])
  const [servicosLoading, setServicosLoading] = useState(true)
  const [servicosError, setServicosError] = useState<string | null>(null)
  const [servicoBusy, setServicoBusy] = useState(false)

  const [addServOpen, setAddServOpen] = useState(false)
  const [newServNome, setNewServNome] = useState("")
  const [newServDesc, setNewServDesc] = useState("")
  const [newServDuracao, setNewServDuracao] = useState("30")
  const [newServPreco, setNewServPreco] = useState("")

  const [editServOpen, setEditServOpen] = useState(false)
  const [editingServ, setEditingServ] = useState<Service | null>(null)
  const [editServNome, setEditServNome] = useState("")
  const [editServDesc, setEditServDesc] = useState("")
  const [editServDuracao, setEditServDuracao] = useState("")
  const [editServPreco, setEditServPreco] = useState("")
  const [editServAtivo, setEditServAtivo] = useState(true)

  const [catalogLojaTab, setCatalogLojaTab] = useState<"svc-catalog" | "prd-catalog">("svc-catalog")
  const [listaProdutosRetail, setListaProdutosRetail] = useState<RetailProduct[]>([])
  const [produtosRetailLoading, setProdutosRetailLoading] = useState(true)
  const [produtosRetailError, setProdutosRetailError] = useState<string | null>(null)
  const [produtoRetailBusy, setProdutoRetailBusy] = useState(false)

  const [addProdRetailOpen, setAddProdRetailOpen] = useState(false)
  const [newProdNome, setNewProdNome] = useState("")
  const [newProdDesc, setNewProdDesc] = useState("")
  const [newProdPreco, setNewProdPreco] = useState("")

  const [editProdRetailOpen, setEditProdRetailOpen] = useState(false)
  const [editingRetailProduct, setEditingRetailProduct] = useState<RetailProduct | null>(null)
  const [editProdNome, setEditProdNome] = useState("")
  const [editProdDesc, setEditProdDesc] = useState("")
  const [editProdPreco, setEditProdPreco] = useState("")
  const [editProdAtivo, setEditProdAtivo] = useState(true)

  const [barbers, setBarbers] = useState<Barber[]>([])
  const [barbersLoading, setBarbersLoading] = useState(true)
  const [equipeError, setEquipeError] = useState<string | null>(null)
  const [equipeBusy, setEquipeBusy] = useState(false)
  const [origin, setOrigin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""))
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newPhotoDraft, setNewPhotoDraft] = useState<string | null>(null)
  const [newCommission, setNewCommission] = useState("50")
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Barber | null>(null)
  const [editName, setEditName] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editCpf, setEditCpf] = useState("")
  const [editPhotoDraft, setEditPhotoDraft] = useState<string | null>(null)
  const [editPhotoPosition, setEditPhotoPosition] = useState(50)
  const [editCommission, setEditCommission] = useState("50")
  const [editActive, setEditActive] = useState(true)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [appProfCopiedId, setAppProfCopiedId] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)
  const [barbeariaSaveOk, setBarbeariaSaveOk] = useState(false)
  const [barbeariaSaveError, setBarbeariaSaveError] = useState<string | null>(null)
  const [isSavingBarbearia, setIsSavingBarbearia] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [linkCompartilhado, setLinkCompartilhado] = useState(false)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const [waLoading, setWaLoading] = useState(false)
  const [waError, setWaError] = useState<string | null>(null)
  const [waPhone, setWaPhone] = useState("")
  const [waConnected, setWaConnected] = useState(false)
  const [waBusy, setWaBusy] = useState(false)
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
  const [newUnitMapsUrl, setNewUnitMapsUrl] = useState("")
  const [unitEditOpen, setUnitEditOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<BarbershopUnit | null>(null)
  const [deleteUnitOpen, setDeleteUnitOpen] = useState(false)
  const [deletingUnit, setDeletingUnit] = useState<BarbershopUnit | null>(null)
  const [deleteCode, setDeleteCode] = useState("")
  const [deleteCodeInput, setDeleteCodeInput] = useState("")
  const [editUnitName, setEditUnitName] = useState("")
  const [editUnitPhone, setEditUnitPhone] = useState("")
  const [editUnitAddress, setEditUnitAddress] = useState("")
  const [editUnitCity, setEditUnitCity] = useState("")
  const [editUnitState, setEditUnitState] = useState("")
  const [editUnitCep, setEditUnitCep] = useState("")
  const [editUnitMapsUrl, setEditUnitMapsUrl] = useState("")
  const [subscriptionBusy, setSubscriptionBusy] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  const [subscriptionOk, setSubscriptionOk] = useState<string | null>(null)
  /** Modal com lista completa de benefícios do plano (card inteiro é clicável). */
  const [planDetailOpen, setPlanDetailOpen] = useState<SubscriptionPlan | null>(null)

  type TrimPlayRankRow = {
    rank: number
    cliente_id: string
    cliente_nome: string
    score: number
    updated_at: string
  }
  const [trimPlayRankRows, setTrimPlayRankRows] = useState<TrimPlayRankRow[]>([])
  const [trimPlayRankLoading, setTrimPlayRankLoading] = useState(false)
  const [trimPlayRankError, setTrimPlayRankError] = useState<string | null>(null)
  const [trimPlayRankUnitId, setTrimPlayRankUnitId] = useState("")

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
      linkGoogleMaps: barbershop.settings?.maps_url ?? "",
    })
    setHorarios(openingHoursFromSettings(barbershop.settings?.opening_hours))
    setBookingRules(bookingRulesFromSettings(barbershop.settings?.booking_rules))
    const w = barbershop.settings?.waitlist_accept_deadline_minutes
    const wn = typeof w === "number" ? w : Number(w)
    setWaitlistAcceptMinutes(
      Number.isFinite(wn) && wn > 0 ? Math.min(24 * 60, Math.round(wn)) : 15
    )
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

  const loadRetailProducts = useCallback(async () => {
    setProdutosRetailLoading(true)
    setProdutosRetailError(null)
    try {
      const r = await fetch("/api/retail-products", { credentials: "include" })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setProdutosRetailError(typeof j.error === "string" ? j.error : "Erro ao carregar produtos")
        setListaProdutosRetail([])
        return
      }
      const data = await r.json()
      setListaProdutosRetail(Array.isArray(data) ? data : [])
    } catch {
      setProdutosRetailError("Erro de rede")
      setListaProdutosRetail([])
    } finally {
      setProdutosRetailLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBarbers()
  }, [loadBarbers])

  useEffect(() => {
    if (!barbershopLoading && barbershop) loadServices()
  }, [barbershopLoading, barbershop?.id, loadServices])

  useEffect(() => {
    if (!barbershopLoading && barbershop) void loadRetailProducts()
  }, [barbershopLoading, barbershop?.id, loadRetailProducts])

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
          setWaConnected(false)
          return
        }
        setWaPlanBlocked(false)
        setWaError(typeof j.error === "string" ? j.error : "Não foi possível carregar")
        setWaPhone("")
        setWaConnected(false)
        return
      }
      setWaPlanBlocked(false)
      if (j && typeof j.phone_number === "string") {
        setWaPhone(j.phone_number)
        setWaConnected(j.connected === true)
      } else {
        setWaPhone("")
        setWaConnected(false)
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

  const loadTrimPlayRanking = useCallback(async () => {
    if (!barbershop?.id) return
    setTrimPlayRankLoading(true)
    setTrimPlayRankError(null)
    const q = trimPlayRankUnitId ? `?unit_id=${encodeURIComponent(trimPlayRankUnitId)}` : ""
    try {
      const r = await fetch(`/api/barbershops/trimplay-ranking${q}`, { credentials: "include" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setTrimPlayRankError(typeof j.error === "string" ? j.error : "Erro ao carregar ranking")
        setTrimPlayRankRows([])
        return
      }
      setTrimPlayRankRows(Array.isArray(j.top) ? j.top : [])
    } catch {
      setTrimPlayRankError("Erro de rede")
      setTrimPlayRankRows([])
    } finally {
      setTrimPlayRankLoading(false)
    }
  }, [barbershop?.id, trimPlayRankUnitId])

  useEffect(() => {
    if (!barbershopLoading && barbershop?.id) void loadTrimPlayRanking()
  }, [barbershopLoading, barbershop?.id, loadTrimPlayRanking])

  const resolveFullBookingUrl = useCallback(() => {
    const o = typeof window !== "undefined" ? window.location.origin : origin
    return barbershop?.slug ? publicBookingUrl(barbershop.slug, o) : ""
  }, [origin, barbershop?.slug])

  useEffect(() => {
    if (!qrDialogOpen) return
    const full = resolveFullBookingUrl()
    if (!full) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    setQrDataUrl(null)
    void import("qrcode").then(({ default: QRCode }) => {
      QRCode.toDataURL(full, { width: 280, margin: 2, errorCorrectionLevel: "M" })
        .then((dataUrl) => {
          if (!cancelled) setQrDataUrl(dataUrl)
        })
        .catch(() => {
          if (!cancelled) setQrDataUrl(null)
        })
    })
    return () => {
      cancelled = true
    }
  }, [qrDialogOpen, resolveFullBookingUrl])

  const linkAgendamento = barbershop?.slug
    ? publicBookingUrl(barbershop.slug, origin)
    : "—"

  const waApiConnected = Boolean(whatsappIntegrationFeature) && waConnected
  const waDigitsOnly = waPhone.replace(/\D/g, "")
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

  const copiarLink = () => {
    const full = resolveFullBookingUrl()
    if (full) void navigator.clipboard.writeText(full)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
  }

  const compartilharLink = async () => {
    const full = resolveFullBookingUrl()
    if (!full) return
    const nav = typeof navigator !== "undefined" ? navigator : undefined
    const marcarCompartilhado = () => {
      setLinkCompartilhado(true)
      setTimeout(() => setLinkCompartilhado(false), 2000)
    }
    try {
      if (nav && "share" in nav && typeof nav.share === "function") {
        await nav.share({
          title: `Agendamento - ${barbershop?.name ?? "Barbearia"}`,
          text: "Um único link: agendar pelo navegador e, no celular, adicionar o app à tela inicial (Chrome/Safari).",
          url: full,
        })
        marcarCompartilhado()
        return
      }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(full)
        marcarCompartilhado()
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      try {
        await navigator.clipboard.writeText(full)
        marcarCompartilhado()
      } catch {
        /* ignore */
      }
    }
  }

  const baixarQrPng = () => {
    if (!qrDataUrl || typeof document === "undefined") return
    const a = document.createElement("a")
    a.href = qrDataUrl
    a.download = `qr-agendamento-${barbershop?.slug ?? "barbearia"}.png`
    a.rel = "noopener"
    a.click()
  }

  const copiarQrComoImagem = async () => {
    if (!qrDataUrl || typeof navigator === "undefined") return
    try {
      const res = await fetch(qrDataUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    } catch {
      /* permissões / navegador */
    }
  }

  const barbeariaSettingsPayload = () => ({
    address: barbearia.endereco.trim() || undefined,
    city: barbearia.cidade.trim() || undefined,
    state: barbearia.estado.trim() || undefined,
    cep: barbearia.cep.trim() || undefined,
    maps_url: normalizeGoogleMapsUrl(barbearia.linkGoogleMaps) ?? "",
  })

  const handleSaveBarbeariaInfo = async () => {
    if (!barbershop) return
    setIsSavingBarbearia(true)
    setBarbeariaSaveError(null)
    setBarbeariaSaveOk(false)
    try {
      const r = await fetch("/api/barbershops", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: barbearia.nome.trim(),
          email: barbearia.email.trim(),
          phone: barbearia.telefone.trim() || null,
          settings: barbeariaSettingsPayload(),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setBarbeariaSaveError(typeof j.error === "string" ? j.error : "Erro ao salvar")
        return
      }
      setBarbeariaSaveOk(true)
      setTimeout(() => setBarbeariaSaveOk(false), 3000)
      await refetch()
    } catch {
      setBarbeariaSaveError("Erro de rede ao salvar")
    } finally {
      setIsSavingBarbearia(false)
    }
  }

  const handleSave = async () => {
    if (!barbershop) return
    setIsSaving(true)
    setSaveError(null)
    setSaveOk(false)
    try {
      const opening_hours = openingHoursToSettings(horarios as Record<string, HorarioDiaUi>)
      const booking_rules = bookingRulesToSettings(bookingRules)
      const r = await fetch("/api/barbershops", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: barbearia.nome.trim(),
          email: barbearia.email.trim(),
          phone: barbearia.telefone.trim() || null,
          settings: {
            ...barbeariaSettingsPayload(),
            opening_hours,
            booking_rules,
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

  const addBlockedRange = (dayKey: (typeof DIAS_SEMANA_KEYS)[number]) => {
    setBookingRules((prev) => ({
      ...prev,
      blockedRanges: {
        ...prev.blockedRanges,
        [dayKey]: [...(prev.blockedRanges[dayKey] ?? []), { start: "12:00", end: "13:00" }],
      },
    }))
  }

  const updateBlockedRange = (
    dayKey: (typeof DIAS_SEMANA_KEYS)[number],
    index: number,
    patch: Partial<BlockedRangeUi>
  ) => {
    setBookingRules((prev) => ({
      ...prev,
      blockedRanges: {
        ...prev.blockedRanges,
        [dayKey]: (prev.blockedRanges[dayKey] ?? []).map((range, i) =>
          i === index ? { ...range, ...patch } : range
        ),
      },
    }))
  }

  const removeBlockedRange = (dayKey: (typeof DIAS_SEMANA_KEYS)[number], index: number) => {
    setBookingRules((prev) => ({
      ...prev,
      blockedRanges: {
        ...prev.blockedRanges,
        [dayKey]: (prev.blockedRanges[dayKey] ?? []).filter((_, i) => i !== index),
      },
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
          description: newServDesc.trim(),
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
      setNewServDesc("")
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
    setEditServDesc(s.description ?? "")
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
          description: editServDesc.trim(),
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

  const handleAddRetailProduct = async () => {
    if (!newProdNome.trim()) return
    const price = Number(newProdPreco)
    if (!Number.isFinite(price) || price < 0) {
      setProdutosRetailError("Preço inválido")
      return
    }
    setProdutoRetailBusy(true)
    setProdutosRetailError(null)
    try {
      const r = await fetch("/api/retail-products", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProdNome.trim(),
          description: newProdDesc.trim(),
          price,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setProdutosRetailError(typeof j.error === "string" ? j.error : "Erro ao criar produto")
        return
      }
      setAddProdRetailOpen(false)
      setNewProdNome("")
      setNewProdDesc("")
      setNewProdPreco("")
      await loadRetailProducts()
    } catch {
      setProdutosRetailError("Erro de rede")
    } finally {
      setProdutoRetailBusy(false)
    }
  }

  const openEditRetail = (p: RetailProduct) => {
    setEditingRetailProduct(p)
    setEditProdNome(p.name)
    setEditProdDesc(p.description ?? "")
    setEditProdPreco(String(p.price))
    setEditProdAtivo(p.active)
    setEditProdRetailOpen(true)
  }

  const handleSaveRetailProduct = async () => {
    if (!editingRetailProduct || !editProdNome.trim()) return
    const price = Number(editProdPreco)
    if (!Number.isFinite(price) || price < 0) {
      setProdutosRetailError("Preço inválido")
      return
    }
    setProdutoRetailBusy(true)
    setProdutosRetailError(null)
    try {
      const r = await fetch(`/api/retail-products/${editingRetailProduct.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editProdNome.trim(),
          description: editProdDesc.trim(),
          price,
          active: editProdAtivo,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setProdutosRetailError(typeof j.error === "string" ? j.error : "Erro ao salvar")
        return
      }
      setEditProdRetailOpen(false)
      setEditingRetailProduct(null)
      await loadRetailProducts()
    } catch {
      setProdutosRetailError("Erro de rede")
    } finally {
      setProdutoRetailBusy(false)
    }
  }

  const handleDeleteRetailProduct = async (p: RetailProduct) => {
    if (!confirm(`Excluir o produto "${p.name}"?`)) return
    setProdutoRetailBusy(true)
    setProdutosRetailError(null)
    try {
      const r = await fetch(`/api/retail-products/${p.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setProdutosRetailError(typeof j.error === "string" ? j.error : "Erro ao excluir")
        return
      }
      await loadRetailProducts()
    } catch {
      setProdutosRetailError("Erro de rede")
    } finally {
      setProdutoRetailBusy(false)
    }
  }

  const handleStartEmbeddedSignup = () => {
    // TODO: Integrate Meta Embedded Signup SDK
    // window.FB.login(callback, { config_id: '...', response_type: 'code', override_default_response_type: true })
  }

  const handleWaDisconnect = async () => {
    if (!confirm("Desconectar o WhatsApp? As mensagens automáticas vão parar de ser enviadas.")) return
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
          maps_url: newUnitMapsUrl.trim() || null,
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
      setNewUnitMapsUrl("")
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
    setEditUnitMapsUrl(unit.maps_url ?? "")
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
          maps_url: editUnitMapsUrl.trim() || null,
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

  const openDeleteUnit = (unit: BarbershopUnit) => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    setDeletingUnit(unit)
    setDeleteCode(code)
    setDeleteCodeInput("")
    setDeleteUnitOpen(true)
  }

  const handleConfirmDeleteUnit = async () => {
    if (!deletingUnit || deleteCodeInput !== deleteCode) return
    setUnitBusy(true)
    setUnitError(null)
    try {
      const r = await fetch(`/api/units/${deletingUnit.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setUnitError(typeof j.error === "string" ? j.error : "Erro ao excluir unidade")
        return
      }
      setDeleteUnitOpen(false)
      setDeletingUnit(null)
      await refetchUnits()
    } catch {
      setUnitError("Erro de rede ao excluir unidade")
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
    setEditPhotoPosition(b.photo_position ?? 50)
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
    if (!newName.trim() || !newPhone.trim()) {
      setEquipeError("Preencha o nome e o telefone do profissional.")
      return
    }
    setEquipeBusy(true)
    setEquipeError(null)
    try {
      const body: { name: string; phone: string; photo_url?: string | null; commission?: number } = {
        name: newName.trim(),
        phone: newPhone.trim(),
        ...(newPhotoDraft ? { photo_url: newPhotoDraft } : {}),
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
      setNewPhotoDraft(null)
      setNewCommission("50")
      await loadBarbers()
    } catch {
      setEquipeError("Erro de rede")
    } finally {
      setEquipeBusy(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editing || !editName.trim() || !editPhone.trim()) {
      if (editing) setEquipeError("Preencha o nome e o telefone do profissional.")
      return
    }
    setEquipeBusy(true)
    setEquipeError(null)
    try {
      const patch: Partial<
        Pick<Barber, "name" | "phone" | "email" | "cpf" | "photo_url" | "photo_position" | "active" | "commission">
      > = {
        name: editName.trim(),
        phone: editPhone.trim() || null,
        email: editEmail.trim() || null,
        cpf: editCpf.trim() || null,
        photo_url: editPhotoDraft,
        photo_position: editPhotoPosition,
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
  /** Cliente pagante em produção não vê blocos de “conta de teste”, Super Admin ou TRIMTIME_UNLOCK. */
  const showInternalAccountHints =
    barbershop?.role === "super_admin" || isLocalDevOrigin(origin)
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
                Só existe <span className="text-foreground font-medium">este</span> endereço: o cliente abre no
                navegador para marcar horário e, no celular, usa o mesmo link para colocar o atalho na tela inicial
                (Chrome no Android, Safari no iPhone — &quot;Adicionar à tela de início&quot;). Pode enviar o link por
                WhatsApp tal como está; não precisa de segunda URL.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-stretch gap-2 p-3 bg-background/50 rounded-lg border border-border">
                <span className="text-primary font-medium flex-1 truncate min-w-0 py-2 sm:py-0 sm:flex sm:items-center">
                  {linkAgendamento}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copiarLink}
                  className="border-primary/30 hover:bg-primary/10 flex-shrink-0"
                >
                  {linkCopiado ? (
                    <>
                      <Check className="w-4 h-4 mr-1 text-green-500" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-border"
                type="button"
                disabled={!barbershop?.slug}
                onClick={() => setQrDialogOpen(true)}
              >
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

      <Dialog
        open={qrDialogOpen}
        onOpenChange={(open) => {
          setQrDialogOpen(open)
          if (!open) setQrDataUrl(null)
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">QR Code do agendamento</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              O cliente escaneia e abre o mesmo link da página pública: marcar horário e, no celular, fixar o atalho na tela
              inicial.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {!resolveFullBookingUrl() ? (
              <p className="text-sm text-muted-foreground text-center">Salve os dados da barbearia para gerar o link.</p>
            ) : !qrDataUrl ? (
              <p className="text-sm text-muted-foreground">Gerando QR Code…</p>
            ) : (
              <img
                src={qrDataUrl}
                alt="QR Code do link de agendamento"
                className="rounded-lg border border-border max-w-[280px] w-full h-auto bg-white p-2"
              />
            )}
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full justify-center">
              <Button type="button" size="sm" variant="outline" onClick={() => copiarLink()} disabled={!resolveFullBookingUrl()}>
                <Copy className="w-4 h-4 mr-1" />
                Copiar link
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={baixarQrPng} disabled={!qrDataUrl}>
                <Download className="w-4 h-4 mr-1" />
                Baixar imagem
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void copiarQrComoImagem()} disabled={!qrDataUrl}>
                Copiar imagem
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="barbearia" className="space-y-6">
        <TabsList className={CONFIG_TABS_LIST_CLASS}>
          <TabsTrigger value="barbearia" className={CONFIG_TAB_TRIGGER_CLASS}>
            <Store className="shrink-0" />
            <span className={CONFIG_TAB_LABEL_CLASS}>Barbearia</span>
          </TabsTrigger>
          <TabsTrigger value="horarios" className={CONFIG_TAB_TRIGGER_CLASS}>
            <Clock className="shrink-0" />
            <span className={CONFIG_TAB_LABEL_CLASS}>Horários</span>
          </TabsTrigger>
          <TabsTrigger value="servicos" className={CONFIG_TAB_TRIGGER_CLASS}>
            <Scissors className="shrink-0" />
            <span className={CONFIG_TAB_LABEL_CLASS}>Serviços</span>
          </TabsTrigger>
          <TabsTrigger value="equipe" className={CONFIG_TAB_TRIGGER_CLASS}>
            <Users className="shrink-0" />
            <span className={CONFIG_TAB_LABEL_CLASS}>Equipe</span>
          </TabsTrigger>
          <TabsTrigger value="plano" className={CONFIG_TAB_TRIGGER_CLASS}>
            <Shield className="shrink-0" />
            <span className={CONFIG_TAB_LABEL_CLASS}>Plano &amp; conta</span>
          </TabsTrigger>
          <TabsTrigger value="unidades" className={CONFIG_TAB_TRIGGER_CLASS}>
            <Building2 className="shrink-0" />
            <span className={CONFIG_TAB_LABEL_CLASS}>Unidades</span>
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className={CONFIG_TAB_TRIGGER_CLASS}>
            <Bell className="shrink-0" />
            <span className={CONFIG_TAB_LABEL_CLASS}>Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="integracao" className={CONFIG_TAB_TRIGGER_CLASS}>
            <Smartphone className="shrink-0" />
            <span className={CONFIG_TAB_LABEL_CLASS}>WhatsApp Business</span>
          </TabsTrigger>
          <TabsTrigger value="trimplay" className={CONFIG_TAB_TRIGGER_CLASS}>
            <Trophy className="shrink-0" />
            <span className={CONFIG_TAB_LABEL_CLASS}>Trim Play</span>
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
                <Field>
                  <MapsLinkFieldLabel htmlFor="linkGoogleMaps" />
                  <Input
                    id="linkGoogleMaps"
                    type="url"
                    inputMode="url"
                    placeholder="https://maps.app.goo.gl/... ou link do Google Maps"
                    value={barbearia.linkGoogleMaps}
                    onChange={(e) =>
                      setBarbearia({ ...barbearia, linkGoogleMaps: e.target.value })
                    }
                    className="bg-input border-border text-foreground mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    O cliente verá este link na tela de agendamento para abrir a rota no Google Maps.
                  </p>
                </Field>

                {barbeariaSaveError ? (
                  <p className="text-sm text-destructive">{barbeariaSaveError}</p>
                ) : null}
                {barbeariaSaveOk ? (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Informações salvas com sucesso.
                  </p>
                ) : null}

                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={() => void handleSaveBarbeariaInfo()}
                    disabled={isSavingBarbearia || !barbershop}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSavingBarbearia ? "Salvando…" : "Salvar informações"}
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="horarios">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Horário de Funcionamento</CardTitle>
              <CardDescription className="text-muted-foreground">
                Defina os dias, horários e regras de agendamento. Use &quot;Salvar alterações&quot; abaixo para
                publicar no link do cliente — o mesmo que o botão no topo da página &quot;Salvar dados e
                horários&quot;.
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

              <div className="mt-8 rounded-lg border border-border p-4 space-y-4">
                <div>
                  <h3 className="text-foreground font-semibold">Regras de agendamento</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure antecedência mínima e bloqueios de horário (folga/almoço) para o cliente no link de agendamento.
                  </p>
                </div>

                <Field className="max-w-[260px]">
                  <FieldLabel htmlFor="min-lead-minutes">Antecedência mínima (minutos)</FieldLabel>
                  <Input
                    id="min-lead-minutes"
                    type="number"
                    min={0}
                    step={5}
                    value={bookingRules.minLeadMinutes}
                    onChange={(e) =>
                      setBookingRules((prev) => ({
                        ...prev,
                        minLeadMinutes: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="bg-input border-border text-foreground"
                  />
                </Field>

                {waitlistFeature ? (
                  <Field className="max-w-[280px]">
                    <FieldLabel htmlFor="waitlist-accept-min">Lista de espera — minutos para aceitar vaga</FieldLabel>
                    <p className="text-xs text-muted-foreground mb-1">
                      Depois que uma vaga é liberada, o cliente tem esse tempo para confirmar; se não confirmar, o
                      próximo na fila é avisado (Plano Pro ou Premium).
                    </p>
                    <Input
                      id="waitlist-accept-min"
                      type="number"
                      min={1}
                      max={1440}
                      step={1}
                      value={waitlistAcceptMinutes}
                      onChange={(e) =>
                        setWaitlistAcceptMinutes(
                          Math.min(24 * 60, Math.max(1, Math.round(Number(e.target.value) || 15)))
                        )
                      }
                      className="bg-input border-border text-foreground"
                    />
                  </Field>
                ) : null}

                <div className="space-y-3">
                  {diasSemana.map((dia) => {
                    const rows = bookingRules.blockedRanges[dia.key] ?? []
                    return (
                      <div key={`blocked-${dia.key}`} className="rounded-md border border-border/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{dia.label}</p>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 border-border"
                            onClick={() => addBlockedRange(dia.key)}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Bloquear faixa
                          </Button>
                        </div>
                        {rows.length === 0 ? (
                          <p className="text-xs text-muted-foreground mt-2">Sem bloqueios neste dia.</p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {rows.map((range, idx) => (
                              <div key={`${dia.key}-${idx}`} className="flex items-center gap-2">
                                <Input
                                  type="time"
                                  value={range.start}
                                  onChange={(e) => updateBlockedRange(dia.key, idx, { start: e.target.value })}
                                  className="w-32 bg-input border-border text-foreground"
                                />
                                <span className="text-muted-foreground text-sm">até</span>
                                <Input
                                  type="time"
                                  value={range.end}
                                  onChange={(e) => updateBlockedRange(dia.key, idx, { end: e.target.value })}
                                  className="w-32 bg-input border-border text-foreground"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-9 px-2 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeBlockedRange(dia.key, idx)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 rounded-lg border border-border bg-secondary/15 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Alterações ficam apenas neste painel até salvar — aí aparecem no agendamento do cliente.
                </p>
                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="servicos">
          <Tabs
            value={catalogLojaTab}
            onValueChange={(v) => setCatalogLojaTab(v as "svc-catalog" | "prd-catalog")}
            className="space-y-4"
          >
            <TabsList className="grid w-full max-w-md grid-cols-2 gap-1 p-1 h-auto rounded-xl bg-secondary/50 border border-border">
              <TabsTrigger
                value="svc-catalog"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Scissors className="h-4 w-4 shrink-0" />
                Serviços
              </TabsTrigger>
              <TabsTrigger
                value="prd-catalog"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <ShoppingBag className="h-4 w-4 shrink-0" />
                Produtos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="svc-catalog" className="mt-0 space-y-0">
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
                    <Field>
                      <FieldLabel>Descrição (opcional)</FieldLabel>
                      <Textarea
                        className="bg-input border-border text-foreground min-h-[88px] resize-y"
                        value={newServDesc}
                        onChange={(e) => setNewServDesc(e.target.value)}
                        placeholder="Ex: Corte degradê, acabamento na tesoura…"
                        maxLength={2000}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Aparece para o cliente na página de agendamento.
                      </p>
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
                      className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                        servico.active ? "border-border bg-secondary/30" : "border-border/50 bg-secondary/10"
                      }`}
                    >
                      <Switch
                        className="mt-1"
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
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium ${servico.active ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {servico.name}
                        </p>
                        <p className="text-sm text-muted-foreground">{servico.duration} minutos</p>
                        <p className="text-xs text-muted-foreground/80 mt-2 font-medium uppercase tracking-wide">
                          Descrição (você e o cliente)
                        </p>
                        {(servico.description ?? "").trim() ? (
                          <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">
                            {(servico.description ?? "").trim()}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground/70 mt-0.5 italic">
                            Sem descrição — o cliente só vê o nome e o preço no agendamento.
                          </p>
                        )}
                      </div>
                      <span className="text-lg font-semibold text-primary shrink-0 pt-0.5">
                        R${Number(servico.price).toFixed(2)}
                      </span>
                      <div className="flex gap-2 shrink-0 pt-0.5">
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
            </TabsContent>

            <TabsContent value="prd-catalog" className="mt-0 space-y-0">
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground">Produtos para venda</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Gel, pomada e outros itens aparecem no agendamento do cliente (opcional).
                    </CardDescription>
                  </div>
                  <Dialog open={addProdRetailOpen} onOpenChange={setAddProdRetailOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                        <Plus className="w-4 h-4 mr-2" />
                        Novo produto
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-border">
                      <DialogHeader>
                        <DialogTitle className="text-foreground">Adicionar produto</DialogTitle>
                      </DialogHeader>
                      <FieldGroup>
                        <Field>
                          <FieldLabel>Nome</FieldLabel>
                          <Input
                            className="bg-input border-border text-foreground"
                            value={newProdNome}
                            onChange={(e) => setNewProdNome(e.target.value)}
                            placeholder="Ex: Pomada matte"
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Descrição (opcional)</FieldLabel>
                          <Textarea
                            className="bg-input border-border text-foreground min-h-[88px] resize-y"
                            value={newProdDesc}
                            onChange={(e) => setNewProdDesc(e.target.value)}
                            placeholder="Opcional — ajuda na identificação"
                            maxLength={2000}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Aparece para o cliente na página de agendamento.
                          </p>
                        </Field>
                        <Field>
                          <FieldLabel>Preço (R$)</FieldLabel>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="bg-input border-border text-foreground"
                            value={newProdPreco}
                            onChange={(e) => setNewProdPreco(e.target.value)}
                          />
                        </Field>
                        <Button
                          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                          disabled={produtoRetailBusy}
                          onClick={() => void handleAddRetailProduct()}
                        >
                          {produtoRetailBusy ? "Salvando…" : "Adicionar"}
                        </Button>
                      </FieldGroup>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {produtosRetailError ? (
                    <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                      {produtosRetailError}
                    </div>
                  ) : null}
                  {produtosRetailLoading ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Carregando produtos…</p>
                  ) : listaProdutosRetail.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Nenhum produto cadastrado.</p>
                  ) : (
                    <div className="space-y-3">
                      {listaProdutosRetail.map((produto) => (
                        <div
                          key={produto.id}
                          className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                            produto.active ? "border-border bg-secondary/30" : "border-border/50 bg-secondary/10"
                          }`}
                        >
                          <Switch
                            className="mt-1"
                            checked={produto.active}
                            disabled={produtoRetailBusy}
                            onCheckedChange={async (on) => {
                              setProdutoRetailBusy(true)
                              try {
                                await fetch(`/api/retail-products/${produto.id}`, {
                                  method: "PATCH",
                                  credentials: "include",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ active: on }),
                                })
                                await loadRetailProducts()
                              } finally {
                                setProdutoRetailBusy(false)
                              }
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${produto.active ? "text-foreground" : "text-muted-foreground"}`}>
                              {produto.name}
                            </p>
                            <p className="text-sm text-muted-foreground">À venda no agendamento</p>
                            <p className="text-xs text-muted-foreground/80 mt-2 font-medium uppercase tracking-wide">
                              Descrição (você e o cliente)
                            </p>
                            {(produto.description ?? "").trim() ? (
                              <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">
                                {(produto.description ?? "").trim()}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground/70 mt-0.5 italic">
                                Sem descrição — o cliente só vê o nome e o preço ao reservar.
                              </p>
                            )}
                          </div>
                          <span className="text-lg font-semibold text-primary shrink-0 pt-0.5">
                            R${Number(produto.price).toFixed(2)}
                          </span>
                          <div className="flex gap-2 shrink-0 pt-0.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              disabled={produtoRetailBusy}
                              onClick={() => openEditRetail(produto)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              disabled={produtoRetailBusy}
                              onClick={() => void handleDeleteRetailProduct(produto)}
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
            </TabsContent>
          </Tabs>

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
                  <Field>
                    <FieldLabel>Descrição (opcional)</FieldLabel>
                    <Textarea
                      className="bg-input border-border text-foreground min-h-[88px] resize-y"
                      value={editServDesc}
                      onChange={(e) => setEditServDesc(e.target.value)}
                      placeholder="Texto para o cliente ver ao escolher o serviço"
                      maxLength={2000}
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

          <Dialog open={editProdRetailOpen} onOpenChange={setEditProdRetailOpen}>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Editar produto</DialogTitle>
              </DialogHeader>
              {editingRetailProduct && (
                <FieldGroup>
                  <Field>
                    <FieldLabel>Nome</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      value={editProdNome}
                      onChange={(e) => setEditProdNome(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Descrição (opcional)</FieldLabel>
                    <Textarea
                      className="bg-input border-border text-foreground min-h-[88px] resize-y"
                      value={editProdDesc}
                      onChange={(e) => setEditProdDesc(e.target.value)}
                      maxLength={2000}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Preço (R$)</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="bg-input border-border text-foreground"
                      value={editProdPreco}
                      onChange={(e) => setEditProdPreco(e.target.value)}
                    />
                  </Field>
                  <div className="flex items-center gap-2">
                    <Switch checked={editProdAtivo} onCheckedChange={setEditProdAtivo} id="prod-retail-ativo" />
                    <FieldLabel htmlFor="prod-retail-ativo" className="cursor-pointer">
                      Ativo
                    </FieldLabel>
                  </div>
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={produtoRetailBusy}
                    onClick={() => void handleSaveRetailProduct()}
                  >
                    {produtoRetailBusy ? "Salvando…" : "Salvar"}
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
                  Cada profissional pode abrir o <span className="text-foreground font-medium">app da equipe</span>{" "}
                  (agenda dia/semana/mês e lista de espera no nome dele) com e-mail, telefone, senha e código de 6
                  dígitos — copie o link abaixo em cada card. Comissão (% sobre o valor do atendimento) nos planos{" "}
                  <strong className="text-foreground">Pro</strong> e <strong className="text-foreground">Premium</strong>
                  {showInternalAccountHints ? (
                    <>
                      {" "}
                      (e para conta <strong className="text-foreground">Super Admin</strong>).
                    </>
                  ) : (
                    "."
                  )}
                </CardDescription>
                {!commissionFeature && (
                  <p className="text-sm text-amber-600/90 dark:text-amber-400/90 mt-2">
                    No plano Básico a comissão fica em 0%. Faça upgrade para definir % por barbeiro.
                  </p>
                )}
              </div>
              <Dialog
                open={addOpen}
                onOpenChange={(open) => {
                  setAddOpen(open)
                  if (!open) {
                    setNewPhotoDraft(null)
                    setNewName("")
                    setNewPhone("")
                    setNewCommission("50")
                    setEquipeError(null)
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo profissional
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Adicionar profissional</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm">
                      Use o botão abaixo para a <span className="text-foreground font-medium">foto do barbeiro</span> que
                      o cliente verá no agendamento.
                    </DialogDescription>
                  </DialogHeader>
                  <FieldGroup>
                    <div className="rounded-xl border-2 border-dashed border-primary/45 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Camera className="w-5 h-5 text-primary shrink-0" />
                        Foto do profissional
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Imagem de quem vai atender — aparece para o cliente ao escolher o profissional. Opcional neste
                        formulário.
                      </p>
                      <input
                        id="config-equipe-novo-barber-photo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          void compressImageToJpegDataUrl(f)
                            .then((url) => {
                              if (url.length > MAX_PROFILE_PHOTO_DATA_URL_CHARS) {
                                setEquipeError("Imagem grande demais. Tente outra foto.")
                                return
                              }
                              setEquipeError(null)
                              setNewPhotoDraft(url)
                            })
                            .catch(() => setEquipeError("Não foi possível ler a imagem"))
                          e.target.value = ""
                        }}
                      />
                      <Button type="button" variant="secondary" className="w-full border-primary/40" asChild>
                        <label
                          htmlFor="config-equipe-novo-barber-photo"
                          className="cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Camera className="w-4 h-4" />
                          Escolher foto do profissional
                        </label>
                      </Button>
                      {newPhotoDraft ? (
                        <div className="flex flex-col items-center pt-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={newPhotoDraft}
                            alt=""
                            className="w-28 h-28 rounded-full object-cover border-2 border-primary/30"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-muted-foreground"
                            onClick={() => setNewPhotoDraft(null)}
                          >
                            Remover foto
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <Field>
                      <FieldLabel>Nome do profissional</FieldLabel>
                      <Input
                        className="bg-input border-border text-foreground"
                        placeholder="Nome do barbeiro"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Telefone</FieldLabel>
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
                      disabled={equipeBusy || !newName.trim() || !newPhone.trim()}
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
                      Gere um link único e envie por WhatsApp. O profissional preenche nome, e-mail, telefone, CPF e{" "}
                      <strong className="text-foreground">foto de perfil</strong> (obrigatória no link) — a mesma foto
                      aparece para o cliente no agendamento. Válido por 7 dias ou até ser usado.
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
                      <Avatar className="w-11 h-11 shrink-0 border border-border">
                        <AvatarImage src={prof.photo_url ?? undefined} alt="" className="object-cover" style={{ objectPosition: `center ${prof.photo_position ?? 50}%` }} />
                        <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
                          {prof.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-[140px]">
                        <p className={`font-medium ${prof.active ? "text-foreground" : "text-muted-foreground"}`}>
                          {prof.name}
                        </p>
                        <div className="text-sm text-muted-foreground space-y-0.5">
                          {prof.phone && <p>{prof.phone}</p>}
                          {prof.email && <p className="truncate">{prof.email}</p>}
                          {prof.portal_token ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-2 h-8 text-xs"
                              onClick={async () => {
                                const base = origin?.trim() || (typeof window !== "undefined" ? window.location.origin : "")
                                const url = `${base}/profissional/${prof.portal_token}`
                                try {
                                  await navigator.clipboard.writeText(url)
                                  setAppProfCopiedId(prof.id)
                                  setTimeout(() => setAppProfCopiedId(null), 2000)
                                  setEquipeError(null)
                                } catch {
                                  setEquipeError("Não foi possível copiar o link do app.")
                                }
                              }}
                            >
                              {appProfCopiedId === prof.id ? (
                                <Check className="w-3.5 h-3.5 mr-1.5" />
                              ) : (
                                <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                              )}
                              {appProfCopiedId === prof.id ? "Link copiado" : "Copiar link do app"}
                            </Button>
                          ) : null}
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
            <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-foreground">Editar profissional</DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm">
                  Foto abaixo é do <span className="text-foreground font-medium">barbeiro</span> — o cliente vê no
                  agendamento.
                </DialogDescription>
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
                    <FieldLabel>Foto do profissional</FieldLabel>
                    <input
                      id="config-equipe-edit-barber-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        void compressImageToJpegDataUrl(f)
                          .then((url) => {
                            if (url.length > MAX_PROFILE_PHOTO_DATA_URL_CHARS) {
                              setEquipeError("Imagem grande demais. Tente outra foto.")
                              return
                            }
                            setEquipeError(null)
                            setEditPhotoDraft(url)
                          })
                          .catch(() => setEquipeError("Não foi possível ler a imagem"))
                        e.target.value = ""
                      }}
                    />
                    <div className="flex flex-col items-center gap-3 py-2">
                      {editPhotoDraft ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={editPhotoDraft}
                          alt=""
                          className="w-24 h-24 rounded-full object-cover border-2 border-primary/40 shadow"
                          style={{ objectPosition: `center ${editPhotoPosition}%` }}
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center border-2 border-dashed border-border">
                          <Camera className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      {editPhotoDraft ? (
                        <div className="w-full space-y-1">
                          <p className="text-xs text-muted-foreground text-center">Ajustar posição</p>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={editPhotoPosition}
                            onChange={(e) => setEditPhotoPosition(Number(e.target.value))}
                            className="w-full accent-primary cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Topo</span>
                            <span>Base</span>
                          </div>
                        </div>
                      ) : null}
                      <label
                        htmlFor="config-equipe-edit-barber-photo"
                        className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        {editPhotoDraft ? "Trocar foto" : "Escolher foto"}
                      </label>
                      {editPhotoDraft ? (
                        <button
                          type="button"
                          onClick={() => { setEditPhotoDraft(null); setEditPhotoPosition(50) }}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Remover foto
                        </button>
                      ) : null}
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel>Telefone</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      placeholder="(11) 99999-9999"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>E-mail (opcional)</FieldLabel>
                    <Input
                      type="email"
                      className="bg-input border-border text-foreground"
                      placeholder="Deixe em branco se não houver"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>CPF (opcional)</FieldLabel>
                    <Input
                      className="bg-input border-border text-foreground"
                      placeholder="Deixe em branco se não houver"
                      value={editCpf}
                      onChange={(e) => setEditCpf(formatCpfDisplay(e.target.value))}
                      maxLength={14}
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
                    disabled={equipeBusy || !editName.trim() || !editPhone.trim()}
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
                  {!managedByBilling && subscription?.plan && showInternalAccountHints && (
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

                <p className="text-xs text-muted-foreground">
                  Clique em qualquer lugar do card do plano para ver a lista completa do que está incluso.
                </p>
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
                        role="button"
                        tabIndex={0}
                        onClick={() => setPlanDetailOpen(planOption)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setPlanDetailOpen(planOption)
                          }
                        }}
                        className={`rounded-lg border p-4 text-left cursor-pointer transition-colors hover:border-primary/60 hover:bg-secondary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
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
                        <p className="mt-2 text-[11px] text-primary/90 font-medium">Ver plano completo →</p>
                        <Button
                          type="button"
                          className="w-full mt-3 bg-primary text-primary-foreground hover:bg-primary/90"
                          disabled={subscriptionBusy || isCurrent}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleChoosePlan(planOption)
                          }}
                        >
                          {actionLabel}
                        </Button>
                      </div>
                    )
                  })}
                </div>

                <Dialog
                  open={planDetailOpen !== null}
                  onOpenChange={(open) => {
                    if (!open) setPlanDetailOpen(null)
                  }}
                >
                  <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[min(90vh,640px)] overflow-y-auto">
                    {planDetailOpen ? (
                      <>
                        <DialogHeader>
                          <DialogTitle className="text-foreground">
                            Plano {PLAN_LABELS[planDetailOpen]}
                          </DialogTitle>
                          <DialogDescription className="text-muted-foreground">
                            <span className="text-primary font-semibold text-base">
                              R$ {PLAN_PRICES[planDetailOpen]}/mês
                            </span>
                            <span className="block mt-2">
                              Tudo que está incluso neste plano para você comparar com tranquilidade.
                            </span>
                          </DialogDescription>
                        </DialogHeader>
                        <ul className="mt-2 space-y-2 text-sm text-muted-foreground border-t border-border pt-4">
                          {PLAN_FEATURES[planDetailOpen].map((feature) => (
                            <li key={`detail_${planDetailOpen}_${feature}`} className="flex gap-2">
                              <Check className="w-4 h-4 shrink-0 text-primary mt-0.5" aria-hidden />
                              <span className="text-foreground/90">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {(() => {
                          const opt = planDetailOpen
                          const isCurrentModal = plan === opt && subscription?.status !== "canceled"
                          const label = isCurrentModal
                            ? "Plano atual"
                            : managedByBilling
                              ? "Contratar este plano"
                              : "Selecionar para teste"
                          return (
                            <Button
                              type="button"
                              className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
                              disabled={subscriptionBusy || isCurrentModal}
                              onClick={() => {
                                void handleChoosePlan(opt)
                                setPlanDetailOpen(null)
                              }}
                            >
                              {label}
                            </Button>
                          )
                        })()}
                      </>
                    ) : null}
                  </DialogContent>
                </Dialog>

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
                {!managedByBilling && showInternalAccountHints && (
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

            {showInternalAccountHints ? (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Informações de conta</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Contexto interno: tipo de conta e desbloqueios de desenvolvimento (visível só para Super Admin ou em
                    localhost).
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
                        <strong className="text-foreground">Dono da barbearia</strong> — configura equipe, serviços e
                        agenda neste painel.
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
            ) : null}
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
                  <Field>
                    <MapsLinkFieldLabel optional />
                    <Input
                      className="bg-input border-border text-foreground mt-2"
                      type="url"
                      inputMode="url"
                      placeholder="https://maps.app.goo.gl/..."
                      value={newUnitMapsUrl}
                      onChange={(e) => setNewUnitMapsUrl(e.target.value)}
                    />
                  </Field>
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
                        {units.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => openDeleteUnit(unit)}
                            disabled={unitBusy || !multiUnitsFeature}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
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
                  <Field>
                    <MapsLinkFieldLabel />
                    <Input
                      className="bg-input border-border text-foreground mt-2"
                      type="url"
                      inputMode="url"
                      placeholder="https://maps.app.goo.gl/..."
                      value={editUnitMapsUrl}
                      onChange={(e) => setEditUnitMapsUrl(e.target.value)}
                    />
                  </Field>
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

          <Dialog
            open={deleteUnitOpen}
            onOpenChange={(open) => {
              setDeleteUnitOpen(open)
              if (!open) {
                setDeletingUnit(null)
                setDeleteCode("")
                setDeleteCodeInput("")
              }
            }}
          >
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader>
                <DialogTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Excluir unidade
                </DialogTitle>
              </DialogHeader>
              {deletingUnit && (
                <div className="space-y-4 py-2">
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-foreground space-y-2">
                    <p>
                      Você está prestes a excluir a unidade <strong>{deletingUnit.name}</strong>.
                    </p>
                    <p className="text-destructive font-medium">
                      Essa ação não pode ser desfeita.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Para confirmar, digite o código abaixo:
                    </p>
                    <div className="flex items-center justify-center">
                      <span className="text-2xl font-mono font-bold tracking-[0.3em] text-foreground bg-secondary px-4 py-2 rounded-lg border border-border select-all">
                        {deleteCode}
                      </span>
                    </div>
                    <Input
                      className="bg-input border-border text-foreground text-center font-mono text-lg tracking-widest uppercase"
                      placeholder="Digite o código acima"
                      value={deleteCodeInput}
                      onChange={(e) => setDeleteCodeInput(e.target.value.toUpperCase())}
                      maxLength={6}
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-border text-foreground"
                      onClick={() => setDeleteUnitOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="flex-1"
                      disabled={unitBusy || deleteCodeInput !== deleteCode}
                      onClick={() => void handleConfirmDeleteUnit()}
                    >
                      {unitBusy ? "Excluindo…" : "Excluir unidade"}
                    </Button>
                  </div>
                </div>
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
          <p className="text-sm text-muted-foreground max-w-2xl">
            As mensagens automáticas por WhatsApp estão na aba{" "}
            <strong className="text-foreground">Integração</strong>.
          </p>
        </TabsContent>

        <TabsContent value="integracao" className="space-y-6">

          {waLoading ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground text-sm">Carregando...</p>
              </CardContent>
            </Card>
          ) : waApiConnected ? (
            /* ── CONECTADO ── */
            <Card className="bg-card border-green-500/20 overflow-hidden">
              <div className="h-1 bg-green-500" />
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-7 h-7 text-green-500" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <p className="text-lg font-semibold text-foreground">WhatsApp conectado</p>
                      <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[11px] font-medium text-green-600 dark:text-green-400">Ativo</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Número: <span className="text-foreground font-medium">{waPhone.trim() || "—"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Seus clientes estão recebendo confirmações, lembretes e mensagens automáticas.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive/30"
                    disabled={waBusy}
                    onClick={() => void handleWaDisconnect()}
                  >
                    {waBusy ? "..." : "Desconectar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* ── NÃO CONECTADO ── */
            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="pt-8 pb-10">
                <div className="text-center space-y-8 max-w-lg mx-auto">
                  <div className="space-y-4">
                    <div className="mx-auto w-20 h-20 rounded-3xl bg-green-500/10 flex items-center justify-center">
                      <MessageSquare className="w-10 h-10 text-green-500" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-foreground">WhatsApp Business</p>
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                        Conecte seu WhatsApp Business oficial para enviar mensagens automáticas aos seus clientes.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-left max-w-sm mx-auto">
                    {[
                      { icon: <CalendarCheck className="w-4 h-4 text-green-500" />, text: "Confirmação de agendamento" },
                      { icon: <Clock3 className="w-4 h-4 text-blue-500" />, text: "Lembretes automáticos" },
                      { icon: <Send className="w-4 h-4 text-primary" />, text: "Mensagens automáticas" },
                      { icon: <Zap className="w-4 h-4 text-amber-500" />, text: "Atendimento automatizado" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2.5 rounded-lg bg-muted/40 border border-border/60 px-3 py-2.5">
                        {item.icon}
                        <span className="text-xs font-medium text-foreground">{item.text}</span>
                      </div>
                    ))}
                  </div>

                  {!whatsappIntegrationFeature ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3 max-w-sm mx-auto">
                      <p className="text-sm font-semibold text-foreground">Disponível no plano Premium</p>
                      <p className="text-xs text-muted-foreground">
                        Faça upgrade para desbloquear o WhatsApp automático e enviar mensagens aos seus clientes.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = "/painel/assinatura"}
                      >
                        Ver planos
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Button
                        type="button"
                        size="lg"
                        className="bg-green-600/60 text-white px-10 h-12 text-base font-semibold cursor-not-allowed"
                        disabled
                      >
                        <Zap className="w-5 h-5 mr-2" />
                        Conectar WhatsApp
                      </Button>
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 max-w-sm mx-auto">
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          Em breve! A conexão oficial com a Meta está sendo finalizada.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {waError ? (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {waError}
            </div>
          ) : null}

          {/* ── COMO FUNCIONA ── */}
          {!waApiConnected && !waLoading ? (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground text-base">Como funciona</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Em poucos cliques seu WhatsApp está conectado e funcionando.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {[
                    { step: "1", icon: <Zap className="w-5 h-5" />, title: "Clique em Conectar", desc: "Abre a tela oficial da Meta" },
                    { step: "2", icon: <Shield className="w-5 h-5" />, title: "Faça login", desc: "Entre com sua conta Facebook/Meta" },
                    { step: "3", icon: <Smartphone className="w-5 h-5" />, title: "Autorize", desc: "Selecione o número WhatsApp" },
                    { step: "4", icon: <CheckCircle2 className="w-5 h-5" />, title: "Pronto!", desc: "Mensagens enviadas automaticamente" },
                  ].map((s) => (
                    <div key={s.step} className="relative flex flex-col items-center text-center p-4 space-y-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        {s.icon}
                      </div>
                      <p className="text-sm font-medium text-foreground">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.desc}</p>
                      <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {s.step}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* ── CONFIGURAÇÕES (só aparece se conectado ou Premium) ── */}
          {whatsappIntegrationFeature ? (
            <>
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground text-base flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    Lembretes automáticos
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    O cliente recebe um aviso no WhatsApp antes do horário marcado.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 max-w-xl">
                  <div className="flex items-center gap-3">
                    <Switch checked={notifWa} onCheckedChange={setNotifWa} id="notif-wa" />
                    <label htmlFor="notif-wa" className="text-sm font-medium text-foreground cursor-pointer">
                      Ativar lembretes por WhatsApp
                    </label>
                  </div>

                  {notifWa && (
                    <div className="space-y-4 pl-1">
                      <p className="text-sm text-muted-foreground">Quando enviar o lembrete:</p>
                      <div className="flex flex-col gap-2.5">
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
                        <FieldLabel>Personalizado (em horas antes)</FieldLabel>
                        <Input
                          type="number"
                          min={1}
                          max={168}
                          className="mt-1 bg-input border-border text-foreground max-w-[160px]"
                          value={notifCustomReminderHours}
                          onChange={(e) => setNotifCustomReminderHours(e.target.value)}
                          placeholder="Ex.: 3"
                        />
                      </Field>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground text-base flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Textos das mensagens
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Personalize o que seus clientes recebem. Use as palavras entre {"{{ }}"} para incluir o nome, data, horário e serviço automaticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 max-w-xl">
                  <Field>
                    <FieldLabel className="flex items-center gap-2">
                      <CalendarCheck className="w-3.5 h-3.5 text-green-500" />
                      Confirmação do agendamento
                    </FieldLabel>
                    <Textarea
                      className="mt-1.5 bg-input border-border text-foreground min-h-[80px]"
                      value={notifWaConfirmTpl}
                      onChange={(e) => setNotifWaConfirmTpl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Enviada quando o cliente marca um horário. Ex.: Olá {"{{nome}}"}, confirmado para {"{{data}}"} às {"{{horario}}"}!
                    </p>
                  </Field>
                  <Field>
                    <FieldLabel className="flex items-center gap-2">
                      <Clock3 className="w-3.5 h-3.5 text-blue-500" />
                      Lembrete antes do horário
                    </FieldLabel>
                    <Textarea
                      className="mt-1.5 bg-input border-border text-foreground min-h-[80px]"
                      value={notifWaTpl}
                      onChange={(e) => setNotifWaTpl(e.target.value)}
                      disabled={!notifWa}
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Enviada antes do horário agendado. Ex.: {"{{nome}}"}, lembrando do seu horário na {"{{barbearia}}"} às {"{{horario}}"}.
                    </p>
                  </Field>
                  <Field>
                    <FieldLabel className="flex items-center gap-2">
                      <Heart className="w-3.5 h-3.5 text-rose-500" />
                      Mensagem pós-atendimento
                    </FieldLabel>
                    <Textarea
                      className="mt-1.5 bg-input border-border text-foreground min-h-[80px]"
                      value={notifWaPostTpl}
                      onChange={(e) => setNotifWaPostTpl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Enviada depois do atendimento. Ex.: Obrigado pela visita, {"{{nome}}"}! Esperamos você na {"{{barbearia}}"}.
                    </p>
                  </Field>

                  <div className="rounded-lg bg-muted/40 border border-border p-3">
                    <p className="text-xs font-medium text-foreground mb-2">Palavras automáticas disponíveis:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { tag: "{{nome}}", desc: "Nome do cliente" },
                        { tag: "{{data}}", desc: "Data do horário" },
                        { tag: "{{horario}}", desc: "Hora do horário" },
                        { tag: "{{servico}}", desc: "Nome do serviço" },
                        { tag: "{{barbearia}}", desc: "Nome da barbearia" },
                      ].map((v) => (
                        <span key={v.tag} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-mono" title={v.desc}>
                          {v.tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={notifBusy}
                  onClick={() => void handleSaveNotificacoes()}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {notifBusy ? "Salvando..." : "Salvar configurações"}
                </Button>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="trimplay" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Ranking do Trim Play
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Lista de jogadores e pontuações do mini jogo no link público de agendamento. Com várias unidades, você
                pode ver o ranking geral da barbearia ou o de cada loja.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {units.length > 0 ? (
                <Field className="max-w-md">
                  <FieldLabel htmlFor="trimplay-rank-unit">Unidade</FieldLabel>
                  <select
                    id="trimplay-rank-unit"
                    value={trimPlayRankUnitId}
                    onChange={(e) => setTrimPlayRankUnitId(e.target.value)}
                    className="mt-1 w-full bg-input border border-border text-foreground text-sm rounded-md px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Geral (sem unidade específica)</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                        {!u.active ? " — inativa" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              {trimPlayRankError ? (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {trimPlayRankError}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-border"
                  disabled={trimPlayRankLoading}
                  onClick={() => void loadTrimPlayRanking()}
                >
                  {trimPlayRankLoading ? "Atualizando…" : "Atualizar lista"}
                </Button>
              </div>

              {trimPlayRankLoading && trimPlayRankRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Carregando ranking…</p>
              ) : trimPlayRankRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma pontuação neste escopo ainda.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-2.5 px-3 font-medium">#</th>
                        <th className="py-2.5 px-3 font-medium">Jogador</th>
                        <th className="py-2.5 px-3 font-medium">ID cliente</th>
                        <th className="py-2.5 px-3 font-medium text-right">Pontos</th>
                        <th className="py-2.5 px-3 font-medium text-right hidden md:table-cell">Atualizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trimPlayRankRows.map((row) => (
                        <tr key={`${row.cliente_id}-${row.rank}`} className="border-b border-border/80">
                          <td className="py-2.5 px-3 text-primary tabular-nums font-medium">{row.rank}</td>
                          <td className="py-2.5 px-3 text-foreground">{row.cliente_nome}</td>
                          <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs truncate max-w-[8rem] md:max-w-none">
                            {row.cliente_id}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-primary">{row.score}</td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground text-xs hidden md:table-cell">
                            {new Date(row.updated_at).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
