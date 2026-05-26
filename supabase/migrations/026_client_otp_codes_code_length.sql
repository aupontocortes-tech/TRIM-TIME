-- OTP do Supabase/Resend tem 6+ caracteres; migração antiga usava VARCHAR(4) e quebrava o insert.
ALTER TABLE client_otp_codes
  ALTER COLUMN code TYPE VARCHAR(16);
