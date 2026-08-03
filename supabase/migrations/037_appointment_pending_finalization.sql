-- Pendente de finalização: horário passou e barbeiro ainda não encerrou o atendimento.
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'pending_finalization';
