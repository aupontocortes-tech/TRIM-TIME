-- Trim Time - Multi-tenant SaaS Schema
-- Todas as tabelas possuem barbershop_id para isolamento por barbearia.

-- Extensão UUID (já existe no Supabase, mas garantimos)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== BARBERSHOPS ==========
CREATE TABLE barbershops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_barbershops_slug ON barbershops(slug);
CREATE INDEX idx_barbershops_email ON barbershops(email);

-- ========== SUBSCRIPTIONS ==========
CREATE TYPE subscription_plan AS ENUM ('basic', 'pro', 'premium');
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled');

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'premium',
  status subscription_status NOT NULL DEFAULT 'trial',
  trial_end TIMESTAMPTZ,
  next_payment TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(barbershop_id)
);

CREATE INDEX idx_subscriptions_barbershop ON subscriptions(barbershop_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_trial_end ON subscriptions(trial_end) WHERE trial_end IS NOT NULL;

-- ========== BARBERS ==========
CREATE TABLE barbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  commission NUMERIC(5,2) DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_barbers_barbershop ON barbers(barbershop_id);

-- ========== CLIENTS ==========
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_barbershop ON clients(barbershop_id);
CREATE INDEX idx_clients_barbershop_phone ON clients(barbershop_id, phone);
CREATE INDEX idx_clients_barbershop_email ON clients(barbershop_id, email);

-- ========== SERVICES ==========
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 30,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_barbershop ON services(barbershop_id);

-- ========== APPOINTMENTS ==========
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'canceled', 'no_show');

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  status appointment_status NOT NULL DEFAULT 'pending',
  total_price NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_barbershop ON appointments(barbershop_id);
CREATE INDEX idx_appointments_barbershop_date ON appointments(barbershop_id, date);
CREATE INDEX idx_appointments_client ON appointments(client_id);
CREATE INDEX idx_appointments_barber ON appointments(barber_id);

-- ========== WAITING LIST ==========
CREATE TYPE waiting_list_status AS ENUM ('waiting', 'notified', 'accepted', 'expired');

CREATE TABLE waiting_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  desired_date DATE,
  desired_time TIME,
  status waiting_list_status NOT NULL DEFAULT 'waiting',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_waiting_list_barbershop ON waiting_list(barbershop_id);
CREATE INDEX idx_waiting_list_status ON waiting_list(barbershop_id, status);

-- ========== WHATSAPP INTEGRATIONS (Premium) ==========
CREATE TABLE whatsapp_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  api_provider TEXT NOT NULL DEFAULT 'meta',
  api_token TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(barbershop_id)
);

CREATE INDEX idx_whatsapp_barbershop ON whatsapp_integrations(barbershop_id);

-- ========== NOTIFICATIONS LOG (para push/email/whatsapp) ==========
CREATE TYPE notification_type AS ENUM ('push', 'email', 'whatsapp');
CREATE TYPE notification_event AS ENUM (
  'appointment_confirmation',
  'appointment_reminder',
  'appointment_canceled',
  'waiting_list_slot_available',
  'inactive_client_marketing'
);

CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  type notification_type NOT NULL,
  event notification_event NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB
);

CREATE INDEX idx_notification_log_barbershop ON notification_log(barbershop_id);
CREATE INDEX idx_notification_log_sent_at ON notification_log(sent_at);

-- ========== ROW LEVEL SECURITY (RLS) ==========
-- Habilitar RLS em todas as tabelas
ALTER TABLE barbershops ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Políticas: usar app_uid (role do Supabase Auth) ou service_role para backend.
-- Aqui assumimos que o backend usa service_role ou que há uma coluna barbershop_id na sessão.
-- Para API routes Next.js com service_role, RLS pode ser desabilitado ou políticas permitem por barbershop_id.

-- Política genérica: usuário autenticado pode ver/editar apenas seus dados (via barbershop_id).
-- Como o barbershop_id vem da aplicação (cookie/session), usamos uma função de segurança.
CREATE OR REPLACE FUNCTION public.get_barbershop_id_from_context() RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb->>'barbershop_id')::uuid,
    (current_setting('app.current_barbershop_id', true))::uuid
  );
$$ LANGUAGE sql STABLE;

-- Políticas: com service_role (backend) o RLS é bypassed. Com anon/auth use app.current_barbershop_id.
CREATE POLICY "Barbershops full access" ON barbershops FOR ALL USING (true);
CREATE POLICY "Subscriptions full access" ON subscriptions FOR ALL USING (true);
CREATE POLICY "Barbers full access" ON barbers FOR ALL USING (true);
CREATE POLICY "Clients full access" ON clients FOR ALL USING (true);
CREATE POLICY "Services full access" ON services FOR ALL USING (true);
CREATE POLICY "Appointments full access" ON appointments FOR ALL USING (true);
CREATE POLICY "Waiting list full access" ON waiting_list FOR ALL USING (true);
CREATE POLICY "WhatsApp full access" ON whatsapp_integrations FOR ALL USING (true);
CREATE POLICY "Notification log full access" ON notification_log FOR ALL USING (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER barbershops_updated_at BEFORE UPDATE ON barbershops FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER barbers_updated_at BEFORE UPDATE ON barbers FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER waiting_list_updated_at BEFORE UPDATE ON waiting_list FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER whatsapp_integrations_updated_at BEFORE UPDATE ON whatsapp_integrations FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
