# O que VOCÊ precisa fazer

O que dava para automatizar já foi feito. Falta só isso:

---

## 1. Colar a chave **service_role** no `.env.local`

O app precisa dessa chave para login, cadastro e painel admin.

1. Abra o [Supabase](https://supabase.com) → seu projeto.
2. Vá em **Project Settings** (engrenagem) → aba **API**.
3. Em **Project API keys**, ache **service_role** e clique em **Reveal**.
4. Copie a chave (começa com `eyJ...`).
5. Abra o arquivo **`.env.local`** na raiz do projeto.
6. Substitua o valor de `SUPABASE_SERVICE_ROLE_KEY`:
   - De: `SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key`
   - Para: `SUPABASE_SERVICE_ROLE_KEY=eyJ...` (a chave que você copiou)

**Não compartilhe essa chave com ninguém.**

---

## 2. Criar as tabelas no Supabase (só uma vez)

Use o **Prisma** na pasta do projeto:

```bash
npm run db:push
```

Isso sincroniza o `prisma/schema.prisma` com o banco e cria/atualiza as tabelas. No Supabase, em **Table Editor**, devem aparecer: barbershops, subscriptions, barbers, clients, services, appointments, waiting_list, whatsapp_integrations, notification_log.

(O `.env.local` já tem `DIRECT_DATABASE_URL` para o Prisma CLI usar conexão direta; o app usa `DATABASE_URL` com o pooler.)

---

## 3. (Opcional) Virar Super Admin

Se quiser acessar o **Painel Admin** (`/admin`):

1. No `.env.local`, troque `seu@email.com` em `SUPER_ADMIN_EMAIL` pelo **seu email**.
2. No app, faça **cadastro** ou **login** com esse mesmo email.

---

## 4. Rodar o projeto

```bash
npm run dev
```

Abre [http://localhost:3001](http://localhost:3001), cadastre uma barbearia e use o painel.

---

**Resumo:** colar a **service_role** no `.env.local` → rodar **`npm run db:push`** (Prisma cria as tabelas) → (opcional) **SUPER_ADMIN_EMAIL** → **`npm run dev`**.
