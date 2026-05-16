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

## OTP por e-mail (cadastro da barbearia)

O cadastro em `/cadastro` envia o código via **Supabase Admin** (`generateLink`), não pelo `signInWithOtp` anônimo (que costuma mandar só link “Confirm signup”).

**Obrigatório na Vercel e no `.env.local`:** `SUPABASE_SERVICE_ROLE_KEY` (além de URL e ANON_KEY).

No template de e-mail do Supabase, inclua `{{ .Token }}` nestes modelos (cadastro usa **Invite**; quem já tentou antes usa **Magic Link** / **Confirm signup**):

- **Invite user** (principal no cadastro novo)
- **Magic Link**
- **Confirm signup**

Recuperação de senha usa **Reset password** — por isso o código podia chegar lá e não no cadastro.

No template **Invite user**, use **somente** o código — **não** coloque `{{ .ConfirmationURL }}` no corpo, senão o e-mail vira um botão de link (e apps de e-mail falso destacam isso em vez dos números):

```html
<h2>Código de acesso</h2>
<p>Seu código para cadastrar sua barbearia no Trim Time:</p>
<h1>{{ .Token }}</h1>
<p>Válido por cerca de 10 minutos. Digite na tela de cadastro do site — não é necessário clicar em link.</p>
```

Peça um **novo código** após alterar o template.

## Período grátis (7 dias na landing)

O valor vem de `platform_settings.default_trial_days` (e opcionalmente `plan_configs.trialDays`). Se a landing mostrar 2 dias, rode no SQL Editor:

`supabase/migrations/022_default_trial_seven_days.sql`

Ou em **Plataforma → Configurações**, defina **Dias grátis no cadastro** = 7.
