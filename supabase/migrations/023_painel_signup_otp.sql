-- OTP de cadastro do painel (auditoria + token pós-verificação). Espelha prisma/schema.prisma.
CREATE TABLE IF NOT EXISTS painel_signup_otp_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code VARCHAR(8) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS painel_signup_otp_sends_email_idx ON painel_signup_otp_sends (email);
CREATE INDEX IF NOT EXISTS painel_signup_otp_sends_expires_at_idx ON painel_signup_otp_sends (expires_at);

CREATE TABLE IF NOT EXISTS painel_signup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS painel_signup_tokens_email_idx ON painel_signup_tokens (email);
