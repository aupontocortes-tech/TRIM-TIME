-- Link do Google Maps por unidade (rota / localização exata no agendamento do cliente).
ALTER TABLE barbershop_units
  ADD COLUMN IF NOT EXISTS maps_url TEXT;
