# Deploy na Vercel (Trim Time)

## ⚠️ Login no celular / site: erro `127.0.0.1:5432` ou "Can't reach database server"

O app na Vercel **não usa o banco do seu PC**. Ele precisa da **mesma** connection string do Supabase que está no `.env.local`.

### Obrigatório na Vercel (Environment Variables)

No projeto Vercel: **Settings → Environment Variables** → adicione para **Production** (e **Preview**, se quiser):

| Nome | Onde copiar |
|------|-------------|
| **`DATABASE_URL`** | Supabase → **Project Settings** → **Database** → *Connection string* → **URI** → modo **Session pooler** (porta **6543**). Substitua `[YOUR-PASSWORD]`. |
| **`DIRECT_DATABASE_URL`** | Mesma tela → **Direct connection** (porta **5432**, host `db.xxx.supabase.co`). Útil para consistência com Prisma CLI; o app em runtime usa sobretudo `DATABASE_URL`. |
| **`NEXT_PUBLIC_SUPABASE_URL`** | Supabase → **Settings → API** → Project URL |
| **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** | Supabase → **anon public** key |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Supabase → **service_role** (reveal) — **nunca** commite no Git |

Depois: **Deployments → Redeploy** (sem cache, se puder).

Se `DATABASE_URL` faltar na Vercel, o Prisma tentava `localhost` e aparecia erro no login (no celular e no próprio site).

---

## ⚠️ 404 branco `NOT_FOUND` (causa nº 1)

URLs longas tipo:

`trim-time-xxxx-1gubd2vpn-thiago-s-projects-xxxx.vercel.app`

são **URL de um deploy específico** (muitas vezes **preview**). Elas **expiram** ou deixam de existir quando há novo deploy. **Não use esse link nos favoritos.**

### Use sempre um destes:

1. **Production**  
   Vercel → **Deployments** → no deploy com selo **Production**, clique **Visit**.  
   Normalmente é algo como: `https://trim-time.vercel.app` (nome curto do projeto).

2. **Settings → Domains**  
   Veja qual domínio está marcado como **Production** e abra só esse.

---

## ⚠️ Branch de produção (`main` vs `master`)

O GitHub do Trim Time usa a branch **`master`**.

Na Vercel, o padrão costuma ser **`main`**. Se **Production Branch** estiver em `main` e você só faz push em `master`, **a produção pode ficar vazia ou antiga** e os links quebram.

**Corrija assim:**

1. Vercel → **Settings** → **Git**
2. Em **Production Branch**, escolha **`master`** (ou renomeie a branch no GitHub para `main` e use só ela).

Salve e faça **Redeploy** do último commit.

---

## Outras verificações

| Onde | O que conferir |
|------|----------------|
| **Deployments** | Último deploy **Ready** (verde), não Error/Canceled |
| **Settings → General → Root Directory** | **Vazio** (raiz do repo, onde está `package.json`) |
| **Output Directory** | **Não** preencher (Next.js na Vercel) |
| **Ignored Build Step** | Vazio ou não ignorar builds sem querer |
| **Environment Variables** | Copiar do `.env.local` para Production (Supabase, DB, etc.) |

## Build local (igual ao da Vercel)

Node **20.9+** (recomendado **22** — veja `.nvmrc`).

```bash
npm ci
npm run build
```

## Arquivos deste repo que ajudam a Vercel

- `vercel.json` — `framework: nextjs`, `npm ci`, `npm run build`
- `package.json` — `engines.node`, `postinstall` com `prisma generate`
