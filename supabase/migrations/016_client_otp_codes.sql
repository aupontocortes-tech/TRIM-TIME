-- OTP por e-mail (cadastro/login sem senha) no agendamento público /b/:slug

CREATE TABLE IF NOT EXISTS client_otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code VARCHAR(4) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  intent VARCHAR(16) NOT NULL DEFAULT 'register',
  nome TEXT NULL,
  telefone TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_otp_codes_shop_email ON client_otp_codes(barbershop_id, email);
CREATE INDEX IF NOT EXISTS idx_client_otp_codes_expires ON client_otp_codes(expires_at);
