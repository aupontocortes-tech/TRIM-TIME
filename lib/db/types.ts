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

export interface Barbershop {
  id: string
  name: string
  email: string
  phone: string | null
  slug: string
  role: BarbershopRole
  suspended_at: string | null
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
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  barbershop_id: string
  name: string
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
  connected_at: string
  updated_at: string
}

export interface DashboardStats {
  appointmentsToday: number
  revenueToday: number
  revenueMonth: number
  topBarber: { barber_id: string; barber_name: string; count: number } | null
  newClientsMonth: number
}

export type NotificationType = "push" | "email" | "whatsapp"
export type NotificationEvent =
  | "appointment_confirmation"
  | "appointment_reminder"
  | "appointment_canceled"
  | "waiting_list_slot_available"
  | "inactive_client_marketing"
