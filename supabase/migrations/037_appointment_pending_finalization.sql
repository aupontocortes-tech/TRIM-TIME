-- Pendente de finalização: horário passou e barbeiro ainda não encerrou o atendimento.
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pending_finalization';
