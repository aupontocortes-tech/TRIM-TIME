# Configuração — Trim Time

## Super Admin (sem pagar)

1. Defina `SUPER_ADMIN_EMAIL` no `.env.local` com o **mesmo e-mail** usado no cadastro/login da barbearia.
2. Essa conta recebe `role = super_admin` na tabela `barbershops` e plano efetivo **Premium** para recursos do painel.
3. Painel global: `/admin`.

## Todas as barbearias com recursos Premium (antes do pagamento)

No `.env.local` (e na Vercel em Preview se precisar):

```env
TRIMTIME_UNLOCK_ALL_PLAN_FEATURES=true
```

Isso faz o servidor tratar **qualquer** barbearia como Premium para `hasFeature`, limites de barbeiros, WhatsApp, serviços, etc.

**Produção com cobrança:** remova ou use `false`.

## Base de dados — horários e endereço

Execute no Supabase (SQL Editor), se ainda não executou:

`supabase/migrations/005_barbershop_settings.sql`

Sem essa coluna, o PATCH da barbearia pode falhar ao salvar configurações.

## Painel do barbeiro

**Painel → Configurações:** dados da barbearia, horários, serviços (API real), equipe, aba **Plano & conta**, **Integrações** (WhatsApp).

## OTP por e-mail (cadastro e login de clientes)

O código numérico é enviado pelo **Supabase Auth**, não pelo app. Se o e-mail vier só com link *“Confirm your signup”* / *“Confirm your mail”* (sem dígitos), ajuste no painel do Supabase:

1. **Authentication → Providers → Email** — habilite envio por **OTP** (código), não só confirmação por link.
2. **Authentication → Email Templates** — no template usado para login/código (ex.: *Magic Link*), o corpo deve incluir `{{ .Token }}` (código), não só `{{ .ConfirmationURL }}`.
3. Opcional: desative **Confirm email** se quiser um único fluxo OTP para cadastro e login (recomendado para o Trim Time).

Depois de alterar, peça um **novo código** na tela de cadastro (o e-mail antigo pode ser só link).

## Período grátis (7 dias na landing)

O valor vem de `platform_settings.default_trial_days` (e opcionalmente `plan_configs.trialDays`). Se a landing mostrar 2 dias, rode no SQL Editor:

`supabase/migrations/022_default_trial_seven_days.sql`

Ou em **Plataforma → Configurações**, defina **Dias grátis no cadastro** = 7.
