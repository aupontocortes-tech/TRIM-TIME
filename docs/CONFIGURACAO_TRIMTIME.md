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
