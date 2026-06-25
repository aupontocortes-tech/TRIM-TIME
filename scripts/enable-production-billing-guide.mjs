/**
 * Checklist para ativar cobrança REAL (Asaas produção) no trimtime.pro.
 * Uso: node scripts/enable-production-billing-guide.mjs
 */
console.log(`
=== ATIVAR COBRANÇA REAL — Trim Time ===

1) Asaas (https://www.asaas.com)
   - Conta PJ aprovada em PRODUÇÃO (não sandbox)
   - Integrações → API → copie a chave de PRODUÇÃO ($aact_prod_...)

2) Webhook no Asaas (produção)
   - URL: https://trimtime.pro/api/webhooks/asaas
   - Token: invente um segredo forte (ex. uuid) → mesmo valor na Vercel
   - Eventos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE,
     PAYMENT_REFUNDED, SUBSCRIPTION_DELETED (e PIX se usar)

3) Vercel → projeto TRIM-TIME → Settings → Environment Variables → Production
   ASAAS_ENVIRONMENT=production
   ASAAS_API_KEY=<chave PRODUÇÃO do Asaas>
   ASAAS_WEBHOOK_TOKEN=<mesmo token do webhook>
   PAYMENT_API_ENABLED=true
   NEXT_PUBLIC_APP_URL=https://trimtime.pro
   REMOVA ou deixe false: ASAAS_SANDBOX_AUTO_CONFIRM

4) Redeploy obrigatório (Deployments → Redeploy)

5) Confirme no app
   - Login barbearia teste → Assinatura
   - Deve aparecer: "Cobrança real (Asaas produção)"

6) Teste do zero (opcional)
   node scripts/reset-barbershop-billing.mjs teste

7) Cadastre cartão REAL e contrate Básico (R$ 19)
   - Confira fatura do cartão em 1–3 dias (às veces na hora)
   - Confira cobrança no painel Asaas produção

IMPORTANTE: chave sandbox + ASAAS_ENVIRONMENT=production NÃO funciona.
`)
