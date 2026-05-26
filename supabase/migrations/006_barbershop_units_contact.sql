-- Contato e endereço por unidade (opcional). E-mail / WhatsApp Business continuam no nível da barbearia.
ALTER TABLE barbershop_units
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT;
