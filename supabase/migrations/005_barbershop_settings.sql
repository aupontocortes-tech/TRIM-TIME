-- Preferências da barbearia (endereço, horários) em JSON — usado pelo painel Configurações
ALTER TABLE barbershops
  ADD COLUMN IF NOT EXISTS settings JSONB;

COMMENT ON COLUMN barbershops.settings IS 'JSON: address, city, state, cep, opening_hours (por dia)';
