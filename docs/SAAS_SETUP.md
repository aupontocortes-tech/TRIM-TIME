# Trim Time - Configuração SaaS Multi-tenant

## Banco de dados (Supabase)

1. Crie um projeto em [Supabase](https://supabase.com).
2. Em **SQL Editor**, execute na ordem:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_super_admin_role.sql`
3. Copie `.env.example` para `.env.local` e preencha com as variáveis do projeto Supabase (Project Settings → API).

## Super Admin (seu login de admin)

- Contas de barbearia têm um campo `role`: `user` (padrão) ou `admin`.
- **Forma mais fácil:** no `.env.local` (ou `.env`) defina sua variável de ambiente com **seu email**:
  ```env
  SUPER_ADMIN_EMAIL=seu@email.com
  ```
  - Se você **ainda não tem conta**: faça o **cadastro** normalmente com esse mesmo email. A conta já será criada como admin.
  - Se você **já tem conta**: faça **login** com esse email. Na primeira vez que entrar, a conta será promovida a admin.
- Após isso, no menu do **painel da barbearia** (/painel) aparecerá o botão **Painel Admin** e você terá **acesso a tudo grátis** (plano Premium para sua barbearia, sem pagar).
- Em `/admin` apenas usuários com `role = 'admin'` podem acessar; os demais são redirecionados para a página inicial.
- No Painel Admin você pode ver totais (barbearias, usuários, assinaturas ativas), listar barbearias, editar dados, alterar plano, suspender/ativar conta e usar **Entrar como usuário** para acessar a conta da barbearia (impersonação). Use **Voltar ao Painel Admin** no topo do painel para sair da impersonação.

**Alternativa (sem variável de ambiente):** no Supabase, SQL Editor:
```sql
UPDATE barbershops SET role = 'admin' WHERE email = 'seu@email.com';
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
