-- Configurações globais da plataforma (Super ADM): WhatsApp da landing, etc.
CREATE TABLE IF NOT EXISTS platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  landing_whatsapp_phone TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (id)
VALUES ('singleton')
ON CONFLICT (id) DO NOTHING;
