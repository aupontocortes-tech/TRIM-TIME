# Deploy na Vercel (Trim Time)

## Se aparecer 404 branco da Vercel (`NOT_FOUND`)

Esse erro **não vem do Next.js** — a Vercel não encontrou um deploy válido para o endereço que você abriu.

### Checklist

1. **Vercel → Project → Deployments**  
   - O último deploy está **Ready** (verde)?  
   - Se estiver **Error** ou **Canceled**, abra o log e corrija o erro.

2. **URL correta**  
   - Use o link **Visit** ao lado do deploy de **Production**.  
   - Exemplo: `https://trim-time-xxx.vercel.app` (sem barra errada no fim).

3. **Root Directory**  
   - Em **Settings → General → Root Directory** deve estar **vazio** (raiz do repositório, onde está o `package.json`).

4. **Framework Preset**  
   - Deve ser **Next.js** (detecção automática costuma acertar).

5. **Output Directory**  
   - Para Next.js, **não** configure “Output Directory” manualmente (deixe em branco / padrão).

6. **Redeploy**  
   - **Deployments → ⋮ → Redeploy** no último commit que passou no build.

## Variáveis de ambiente

No painel da Vercel, **Settings → Environment Variables**, replique o que você usa no `.env.local` (Supabase, `DATABASE_URL`, etc.) para **Production** (e Preview, se quiser).

## Build local (igual à Vercel)

```bash
npm ci
npm run build
```

Se isso passar no seu PC, o mesmo `npm run build` na Vercel deve funcionar com as mesmas variáveis necessárias em runtime.
