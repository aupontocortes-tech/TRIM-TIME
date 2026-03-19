# Deploy na Vercel (Trim Time)

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
