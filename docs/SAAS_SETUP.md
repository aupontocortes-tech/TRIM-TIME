# Trim Time - Configuração SaaS Multi-tenant

## Banco de dados (Supabase)

1. Crie um projeto em [Supabase](https://supabase.com).
2. **Opção A – Prisma (tabelas automáticas):**  
   Defina `DATABASE_URL` no `.env.local` com a connection string do Supabase (Project Settings → Database → Connection string, modo Transaction ou Session). Depois rode:
   ```bash
   npm run db:push
   ```
   Isso cria/atualiza todas as tabelas a partir de `prisma/schema.prisma`. Para migrations versionadas: `npm run db:migrate`.
3. **Opção B – SQL manual:**  
   No **SQL Editor** do Supabase, execute na ordem:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_super_admin_role.sql`
   - `supabase/migrations/003_roles_super_admin_admin_barbershop_user.sql`
4. Copie `.env.example` para `.env.local` e preencha com as variáveis do projeto Supabase (Project Settings → API). Inclua `DATABASE_URL` se for usar Prisma.

## Sistema de permissões

- **Roles na barbearia (conta):** `super_admin` = dono do sistema (acesso ao painel /admin) | `admin_barbershop` = dono da barbearia (padrão ao criar conta).
- **Roles em barbeiros (tabela `barbers`):** `admin_barbershop` = dono | `user` = barbeiro normal (no futuro, login de barbeiro com role `user` vê só Agenda e Clientes).

### Super Admin (seu login de admin)

- **Forma mais fácil:** no `.env.local` defina **seu email**:
  ```env
  SUPER_ADMIN_EMAIL=seu@email.com
  ```
  - Se você **ainda não tem conta**: faça o **cadastro** com esse email. A conta será criada como `super_admin`.
  - Se você **já tem conta**: faça **login** com esse email; a conta será promovida a `super_admin`.
- No menu do **painel** (/painel) aparecerá o link **Painel Admin** e você terá plano Premium grátis para sua barbearia.
- A rota `/admin` só é acessível para `role = 'super_admin'`; os demais são redirecionados para a página inicial.
- No Painel Admin: dashboard (totais de barbearias, usuários, assinaturas ativas), lista de barbearias, editar dados, **alterar tipo de conta** (Super Admin / Dono da barbearia), alterar plano, suspender/ativar e **Entrar como usuário** (impersonação). Use **Voltar ao Painel Admin** para sair da impersonação.

**Alternativa (sem variável de ambiente):** no Painel Admin, edite sua barbearia e em "Tipo de conta" escolha **Super Admin**. Ou no Supabase, SQL Editor:
```sql
UPDATE barbershops SET role = 'super_admin' WHERE email = 'seu@email.com';
```

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role (só no backend, nunca no cliente) |

## Fluxo de autenticação atual

- **Cadastro (barbearia)**: `POST /api/barbershops` cria a barbearia e uma assinatura em **trial (7 dias Premium)**. Em seguida, `POST /api/auth/session` define o cookie `trimtime_barbershop_id`.
- **Login**: `POST /api/auth/login` busca barbearia por email e define o mesmo cookie.
- Todas as APIs protegidas leem `barbershop_id` do cookie e filtram dados por ele (multi-tenant).

Para produção, recomenda-se trocar por **Supabase Auth** e guardar `barbershop_id` no `user_metadata` ou em uma tabela `profiles`.

## Planos e limites

- **Básico**: 1 barbeiro; agenda, clientes, histórico, anotações, push.
- **Pro**: até 5 barbeiros; lista de espera, financeiro, relatórios, comissão, serviços/preços, email, backup.
- **Premium**: barbeiros ilimitados; agendamento online, link público, dashboard completo, relatórios avançados, fidelidade, marketing, WhatsApp, remover branding.

O bloqueio por plano está nas APIs (ex.: `POST /api/barbers` retorna 403 com `code: "PLAN_LIMIT"` quando o limite de barbeiros é atingido). No front, use o componente `UpgradePlanDialog` ao receber 403 ou ao tentar ações acima do plano.

## Lista de espera

Quando um agendamento é **cancelado** (`PATCH /api/appointments/:id` com `status: "canceled"` ou `DELETE`), o sistema:

1. Busca o primeiro item da lista de espera (status `waiting`) da barbearia.
2. Atualiza para `notified` e registra em `notification_log` (evento `waiting_list_slot_available`).
3. O envio real de push/email/WhatsApp deve ser implementado em um job (ex.: Inngest, Vercel Cron) que lê `notification_log` e chama os provedores.

## Notificações

- **Push**: registrar em `notification_log`; em produção, integrar com Firebase Cloud Messaging ou OneSignal.
- **Email**: usar Resend, SendGrid ou Supabase Edge Function; ler payload (ex.: `client_id`, `appointment_id`) e enviar template.
- **WhatsApp (Premium)**: credenciais em `whatsapp_integrations`; usar Meta Cloud API para envio. Fluxo de “Conectar WhatsApp” em Configurações → Integrações: OAuth Meta e salvar token via `POST /api/whatsapp`.

## Dashboard

- `GET /api/dashboard` retorna: agendamentos do dia, faturamento do dia, faturamento do mês, barbeiro com mais atendimentos no dia, novos clientes no mês.
- O painel admin já consome essa API e exibe os dados reais.

## Escalabilidade

- Todas as tabelas têm `barbershop_id` e índices por ele.
- Use sempre `requireBarbershopId()` ou `getBarbershopIdFromRequest()` nas APIs e filtre todas as queries por `barbershop_id`.
- RLS está habilitado; com `service_role` as políticas atuais permitem tudo (o isolamento é feito na aplicação). Para usar apenas chave anon, ajuste as políticas para usar `app.current_barbershop_id` definido pelo backend.
