# Trim Time — modelo de dados e arquitetura (inventário)

Documento para **extensão segura** do SaaS. O app hoje usa **Supabase** nas APIs e **Prisma** como fonte de schema/cliente.

## 1. O que já existe (resumo)

| Área | Tabelas / modelo | Observação |
|------|------------------|------------|
| Multi-tenant | `barbershops` | Conta da barbearia; `role` (`super_admin` / `admin_barbershop`) |
| Assinatura | `subscriptions` | Plano `basic` / `pro` / `premium`, status, trial |
| Equipe | `barbers` | Comissão %, `role` barbeiro (`admin_barbershop` / `user`) |
| Clientes | `clients` | Contato + notas |
| Serviços | `services` | Preço, duração |
| Agenda | `appointments` | Cliente + barbeiro + serviço + data/hora + status + `total_price` |
| Lista de espera | `waiting_list` | Notificação ao cancelar slot (API já dispara fluxo) |
| Notificações (log) | `notification_log` | Tipos push/email/whatsapp + evento + payload JSON |
| WhatsApp (stub) | `whatsapp_integrations` | Estrutura por barbearia |
| Limites de plano | `lib/plans.ts` | 1 / 5 / ∞ barbeiros; `hasFeature`, `canUseBarberCommission` |
| Comissão (cálculo) | `lib/commissions.ts` | Agregação por período; % em `barbers` |
| Sessão | Cookie `trimtime_barbershop_id` | Login por e-mail da barbearia |

## 2. Lacunas estruturais (endereçadas incrementalmente)

- **Pagamentos**: gateway futuro → tabela `payments` (provedor, status, metadata).
- **Financeiro detalhado**: lançamentos → `financial_ledger_entries` (entrada/saída, vínculo opcional com `appointments`).
- **Fidelidade**: saldo em `clients.loyalty_points` + histórico `loyalty_ledger_entries`.
- **Marketing**: campanhas agendadas → `marketing_campaigns` (payload JSON, canal, status).
- **Multi-unidade (Premium)**: `barbershop_units` + `appointments.unit_id` (opcional, sem quebrar agenda atual).
- **Snapshot de comissão**: `appointments.commission_percent` / `commission_amount` (opcional, para histórico estável).
- **Auth por barbeiro (futuro)**: `barbers.auth_user_id` opcional (ligação Supabase Auth).
- **Conflito de horário**: checagem na API ao criar agendamento (`lib/scheduling.ts`).

## 3. Relacionamentos alvo (já refletidos no Prisma onde aplicável)

```
barbershop 1─* barbers, clients, services, appointments, subscriptions
barbershop 1─* payments, financial_ledger_entries, marketing_campaigns, barbershop_units
client 1─* appointments, loyalty_ledger_entries
barber 1─* appointments
appointment *─? financial_ledger_entries (opcional)
appointment *─? loyalty_ledger_entries (opcional)
```

## 4. Permissões (código)

- **Plano**: `lib/plans.ts` + `lib/barbershop-plan-server.ts` (`fetchBarbershopPlanContext`).
- **Super admin SaaS**: `role === "super_admin"` na barbearia + `SUPER_ADMIN_EMAIL` no cadastro/login.
- **Barbeiro**: `barbers.role` (`user` vs `admin_barbershop`) — menu no `painel/layout.tsx`.

Helpers centralizados: `lib/access-control.ts` (reexport + `isPlatformAdmin`).

## 5. Aplicar migração SQL (Supabase)

Rodar no **SQL Editor** do Supabase (ou pipeline de migrations):

`supabase/migrations/004_architecture_extensions.sql`  
`supabase/migrations/005_barbershop_settings.sql` — coluna `barbershops.settings` (endereço + `opening_hours`).

**Desenvolvimento:** `TRIMTIME_UNLOCK_ALL_PLAN_FEATURES=true` no `.env.local` / Vercel faz o plano efetivo ser Premium para todas as barbearias (ver `lib/subscription.ts`). Remover em produção com cobrança.

Depois: `npx prisma db pull` (se quiser alinhar introspection) ou manter schema Prisma como fonte e `prisma db push` em dev.

## 6. Próximos passos sugeridos (sem quebrar UI)

- Preencher `commission_*` ao marcar `completed`.
- Inserir em `financial_ledger_entries` quando houver pagamento confirmado.
- Worker/cron para e-mail/WhatsApp usando `notification_log` + filas.
