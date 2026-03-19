-- =============================================================================
-- TRIM TIME - Criar todas as tabelas no Supabase (rode este arquivo no SQL Editor)
-- =============================================================================
-- No Supabase: SQL Editor → New query → cole TUDO → Run
-- =============================================================================

-- Remove tabela com nome errado (se o Prisma criou "Barbershop" com B maiúsculo)
DROP TABLE IF EXISTS "Barbershop" CASCADE;

-- Extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== BARBERSHOPS ==========
CREATE TABLE IF NOT EXISTS barbershops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  slug TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin_barbershop' CHECK (role IN ('super_admin', 'admin_barbershop')),
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_barbershops_slug ON barbershops(slug);
CREATE INDEX IF NOT EXISTS idx_barbershops_email ON barbershops(email);
CREATE INDEX IF NOT EXISTS idx_barbershops_role ON barbershops(role);

-- ========== SUBSCRIPTIONS ==========
DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('basic', 'pro', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS subscriptions (
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_barbershop ON subscriptions(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ========== BARBERS ==========
CREATE TABLE IF NOT EXISTS barbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  commission NUMERIC(5,2) DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin_barbershop', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_barbers_barbershop ON barbers(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_barbers_role ON barbers(barbershop_id, role);

-- ========== CLIENTS ==========
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_barbershop ON clients(barbershop_id);

-- ========== SERVICES ==========
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 30,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_barbershop ON services(barbershop_id);

-- ========== APPOINTMENTS ==========
DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'canceled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS appointments (
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

CREATE INDEX IF NOT EXISTS idx_appointments_barbershop ON appointments(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_appointments_barbershop_date ON appointments(barbershop_id, date);

-- ========== WAITING LIST ==========
DO $$ BEGIN
  CREATE TYPE waiting_list_status AS ENUM ('waiting', 'notified', 'accepted', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS waiting_list (
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

CREATE INDEX IF NOT EXISTS idx_waiting_list_barbershop ON waiting_list(barbershop_id);

-- ========== WHATSAPP INTEGRATIONS ==========
CREATE TABLE IF NOT EXISTS whatsapp_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  api_provider TEXT NOT NULL DEFAULT 'meta',
  api_token TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(barbershop_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_barbershop ON whatsapp_integrations(barbershop_id);

-- ========== NOTIFICATION LOG ==========
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('push', 'email', 'whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE notification_event AS ENUM (
    'appointment_confirmation',
    'appointment_reminder',
    'appointment_canceled',
    'waiting_list_slot_available',
    'inactive_client_marketing'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  type notification_type NOT NULL,
  event notification_event NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_notification_log_barbershop ON notification_log(barbershop_id);

-- ========== RLS (permitir backend com service_role) ==========
ALTER TABLE barbershops ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Barbershops full access" ON barbershops;
DROP POLICY IF EXISTS "Subscriptions full access" ON subscriptions;
DROP POLICY IF EXISTS "Barbers full access" ON barbers;
DROP POLICY IF EXISTS "Clients full access" ON clients;
DROP POLICY IF EXISTS "Services full access" ON services;
DROP POLICY IF EXISTS "Appointments full access" ON appointments;
DROP POLICY IF EXISTS "Waiting list full access" ON waiting_list;
DROP POLICY IF EXISTS "WhatsApp full access" ON whatsapp_integrations;
DROP POLICY IF EXISTS "Notification log full access" ON notification_log;

CREATE POLICY "Barbershops full access" ON barbershops FOR ALL USING (true);
CREATE POLICY "Subscriptions full access" ON subscriptions FOR ALL USING (true);
CREATE POLICY "Barbers full access" ON barbers FOR ALL USING (true);
CREATE POLICY "Clients full access" ON clients FOR ALL USING (true);
CREATE POLICY "Services full access" ON services FOR ALL USING (true);
CREATE POLICY "Appointments full access" ON appointments FOR ALL USING (true);
CREATE POLICY "Waiting list full access" ON waiting_list FOR ALL USING (true);
CREATE POLICY "WhatsApp full access" ON whatsapp_integrations FOR ALL USING (true);
CREATE POLICY "Notification log full access" ON notification_log FOR ALL USING (true);

-- ========== Trigger updated_at ==========
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS barbershops_updated_at ON barbershops;
CREATE TRIGGER barbershops_updated_at BEFORE UPDATE ON barbershops FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS barbers_updated_at ON barbers;
CREATE TRIGGER barbers_updated_at BEFORE UPDATE ON barbers FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS clients_updated_at ON clients;
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS services_updated_at ON services;
CREATE TRIGGER services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS appointments_updated_at ON appointments;
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS waiting_list_updated_at ON waiting_list;
CREATE TRIGGER waiting_list_updated_at BEFORE UPDATE ON waiting_list FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS whatsapp_integrations_updated_at ON whatsapp_integrations;
CREATE TRIGGER whatsapp_integrations_updated_at BEFORE UPDATE ON whatsapp_integrations FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
