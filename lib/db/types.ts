/**
 * Tipos do banco de dados - Trim Time SaaS
 * Todas as entidades são multi-tenant por barbershop_id.
 */

export type SubscriptionPlan = "basic" | "pro" | "premium"
export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled"
export type AppointmentStatus = "pending" | "confirmed" | "completed" | "canceled" | "no_show"
export type WaitingListStatus = "waiting" | "notified" | "accepted" | "expired"

/** Conta da barbearia: super_admin = dono do sistema; admin_barbershop = dono da barbearia (padrão). */
export type BarbershopRole = "super_admin" | "admin_barbershop"

/** Horário por dia (chaves: segunda, terca, …) — guardado em barbershops.settings.opening_hours */
export type BarbershopOpeningDay = { active: boolean; open: string; close: string }

/** Preferências de lembrete de agendamento (salvas em `barbershops.settings.notification_settings`). */
export type BarbershopNotificationSettings = {
  /** Antes do horário do serviço, em minutos (ex.: 30, 60, 120, 1440 = 1 dia). */
  reminder_offsets_minutes?: number[]
  /** Antecedência extra em minutos (ex.: 180 = 3 h), além das opções fixas. */
  reminder_custom_minutes?: number | null
  /** Aviso no app / PWA do cliente. */
  notify_app?: boolean
  /** Envio por WhatsApp quando a integração estiver ativa (lembretes agendados). */
  notify_whatsapp?: boolean
  /** Confirmação automática por API ao criar agendamento (padrão: ativo se não definido). */
  whatsapp_send_confirmation?: boolean
  /** Mensagem pós-atendimento ao marcar como concluído (padrão: ativo se não definido). */
  whatsapp_send_post_service?: boolean
  /** Texto com placeholders: {{nome_cliente}}, {{data}}, {{horario}}, {{servico}}, {{barbearia}} */
  app_reminder_template?: string
  whatsapp_reminder_template?: string
  /** Confirmação (API). Também aceita {{nome}} e {{hora}} (sinônimos). */
  whatsapp_confirmation_template?: string
  /** Pós-atendimento (API). */
  whatsapp_post_service_template?: string
  /**
   * Nome da template oficial Meta (opcional). Quando preenchido, o backend pode priorizar
   * envio por template aprovado em vez de texto livre (evolução futura).
   */
  whatsapp_meta_template_confirmation?: string
  whatsapp_meta_template_reminder?: string
  whatsapp_meta_template_post_service?: string
}

export type BarbershopSettings = {
  address?: string
  city?: string
  state?: string
  cep?: string
  opening_hours?: Record<string, BarbershopOpeningDay>
  notification_settings?: BarbershopNotificationSettings
}

export interface Barbershop {
  id: string
  name: string
  email: string
  phone: string | null
  slug: string
  role: BarbershopRole
  suspended_at: string | null
  /** Conta de teste: recursos premium sem cobrança (definido pelo super admin). */
  is_test?: boolean
  created_at: string
  updated_at: string
  /** Preferência da API GET /api/barbershops (merge de JSONB). */
  settings?: BarbershopSettings | null
  /**
   * Só no JSON da API: plano já com super_admin, trial e TRIMTIME_UNLOCK_ALL_PLAN_FEATURES.
   * Use no cliente em vez de recalcular só com subscription.
   */
  effective_plan?: SubscriptionPlan | null
}

export interface BarbershopUnit {
  id: string
  barbershop_id: string
  name: string
  /** Telefone da unidade (opcional). E-mail da conta continua em `barbershop.email`. */
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  cep?: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  barbershop_id: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  trial_end: string | null
  next_payment: string | null
  created_at: string
  updated_at: string
}

/** Role do barbeiro: admin_barbershop = dono; user = barbeiro normal (menu: só agenda e clientes). */
export type BarberRole = "admin_barbershop" | "user"

export interface Barber {
  id: string
  barbershop_id: string
  name: string
  phone: string | null
  email?: string | null
  cpf?: string | null
  photo_url?: string | null
  commission: number
  active: boolean
  role?: BarberRole
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  barbershop_id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  cpf?: string | null
  photo_url?: string | null
  loyalty_points?: number
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  barbershop_id: string
  name: string
  /** Descrição opcional visível ao cliente no agendamento. */
  description: string
  price: number
  duration: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  barbershop_id: string
  client_id: string
  barber_id: string
  service_id: string
  date: string
  time: string
  status: AppointmentStatus
  total_price: number | null
  commission_percent?: number | null
  commission_amount?: number | null
  unit_id?: string | null
  created_at: string
  updated_at: string
  // joins opcionais
  client?: Client
  barber?: Barber
  service?: Service
}

export interface WaitingListItem {
  id: string
  barbershop_id: string
  client_id: string
  service_id: string
  desired_date: string | null
  desired_time: string | null
  status: WaitingListStatus
  notified_at: string | null
  created_at: string
  updated_at: string
  client?: Client
  service?: Service
}

export interface WhatsAppIntegration {
  id: string
  barbershop_id: string
  phone_number: string
  api_provider: string
  api_token: string | null
  graph_phone_number_id?: string | null
  has_api_token?: boolean
  connected_at: string
  updated_at: string
}

export interface DashboardStats {
  appointmentsToday: number
  revenueToday: number
  revenueMonth: number
  topBarber: { barber_id: string; barber_name: string; count: number } | null
  newClientsMonth: number
  /** Comissões dos barbeiros no mês (só plano Pro/Premium; senão 0). */
  commissionMonth: number
  commissionEnabled: boolean
}

export type NotificationType = "push" | "email" | "whatsapp"
export type NotificationEvent =
  | "appointment_confirmation"
  | "appointment_reminder"
  | "appointment_canceled"
  | "waiting_list_slot_available"
  | "inactive_client_marketing"
