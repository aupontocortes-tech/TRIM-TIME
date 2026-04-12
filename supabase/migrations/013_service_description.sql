-- Descrição opcional do serviço (visível ao cliente no agendamento).
ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
