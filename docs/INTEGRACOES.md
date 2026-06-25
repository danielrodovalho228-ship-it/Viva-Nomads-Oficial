# Integrações do Viva Nomads — o que você vai precisar

> Todas seguem o mesmo padrão: **se a variável de ambiente existir, usa o serviço
> real; se não, opera em modo demonstração** (dados simulados, sem quebrar).
> Configure tudo na **Vercel → Settings → Environment Variables (Production)** e
> faça **Redeploy**. O endpoint `GET /api/health` mostra o que está ligado.

## 🟥 Essenciais (sem isso o app não opera no real)

### 1. Supabase — banco, login e storage
- **Para quê:** Postgres (imóveis, perfis, contratos…), Auth (login/cadastro) e Storage (fotos dos imóveis).
- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Sua ação:** criar projeto, rodar as migrações (passo a passo), e **criar o bucket de Storage** `property-photos` (público) para o upload de fotos funcionar.
- **Código:** ✅ pronto, com RLS.

### 2. Asaas — pagamentos (Brasil)
- **Para quê:** assinatura recorrente do proprietário, comissão de fechamento com **split**, PIX/boleto/cartão.
- **Env:** `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_ENV` (`sandbox`|`production`)
- **Sua ação:** criar conta Asaas, pegar a API key, e cadastrar a URL do webhook `https://vivanomads.com.br/api/webhooks/asaas` com o token.
- **Código:** ✅ cobranças/assinatura/subconta prontas. ⚠️ **Ver achados 1 e 2 abaixo** (webhook e persistência da subconta).

## 🟧 Importantes (recursos-chave do produto)

### 3. Mapbox — mapas + autocomplete de cidade
- **Para quê:** mapa da busca/imóvel e geocoding (autocomplete de endereço com coordenadas).
- **Env:** `NEXT_PUBLIC_MAPBOX_TOKEN`
- **Sua ação:** criar token no Mapbox e **autorizar o domínio** `vivanomads.com.br`.
- **Código:** ✅ com placeholder de marca sem token; o autocomplete de cidades já tem fallback próprio (funciona no mobile).

### 4. Resend — e-mail transacional
- **Para quê:** e-mails do app (avisos, documentos). *Observação:* o e-mail de **confirmação/reset de senha** é enviado pelo **SMTP do Supabase Auth** (config separada), não por aqui.
- **Env:** `RESEND_API_KEY`, `RESEND_FROM`
- **Sua ação:** conta Resend + domínio verificado (SPF/DKIM).
- **Código:** ✅ pronto.

### 5. CAF (Combate à Fraude) — verificação de identidade
- **Para quê:** verificar o inquilino (identidade, OCR de documento, prova de vida, risco) — o semáforo do fechamento. Cobre estrangeiros (CRNM/RNE).
- **Env:** `CAF_API_TOKEN`, `CAF_TEMPLATE_ID`
- **Sua ação:** contratar CAF, pegar token e template.
- **Código:** ✅ pronto; sem token devolve laudo simulado (verde).

### 6. ZapSign — assinatura digital do contrato
- **Para quê:** gerar e assinar o contrato de locação (validade jurídica, Lei 14.063/2020).
- **Env:** `ZAPSIGN_API_TOKEN`
- **Sua ação:** conta ZapSign + (recomendado) um **template** com campos dinâmicos.
- **Código:** ✅ pronto; sem token simula o envio.

## 🟩 Opcionais / fase futura

### 7. Google Places — espaços de trabalho próximos
- **Para quê:** popular coworkings/cafés perto do imóvel (selo "Pronto para Trabalho").
- **Env:** `GOOGLE_PLACES_API_KEY` · **Código:** ✅ com exemplos sem key. ℹ️ usa o endpoint *legado* (achado 4).

### 8. Z-API — WhatsApp
- **Para quê:** notificações por WhatsApp.
- **Env:** `ZAPI_INSTANCE`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` · **Código:** ✅ pronto.

### 9. NFS-e (Focus NFe / PlugNotas) — nota fiscal
- **Para quê:** emitir NF das receitas da plataforma (comissão/assinatura).
- **Env:** `NFSE_API_TOKEN`, `NFSE_PROVIDER` · **Código:** ✅ pronto; NF do aluguel pelo proprietário fica para fase futura.

### 10. PostHog — analytics
- **Env:** `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- **Código:** ⚠️ está no `.env.example` mas **ainda NÃO está implementado** no app (achado 5). As variáveis sozinhas não coletam nada.

### Sem configuração (já funcionam, grátis)
- **ViaCEP** — autocomplete de endereço por CEP no cadastro do imóvel. Sem chave.

---

## 🔎 Achados da auditoria (o que revisar antes de cobrar de verdade)

1. **Asaas webhook é um esqueleto (TODO).** `src/app/api/webhooks/asaas/route.ts` valida o token e recebe os eventos, mas **não atualiza o banco** — `PAYMENT_CONFIRMED`/`PAYMENT_OVERDUE` não marcam a assinatura como ativa/inadimplente em `subscriptions`/`transactions`. **Impacto:** com Asaas ligado, o pagamento é cobrado, mas o status no app não muda sozinho. **Ação:** implementar a gravação no Supabase.
2. **Subconta Asaas não é persistida.** `createSubaccount` devolve `walletId` e `apiKey` (a apiKey vem **uma única vez**), mas não há código salvando isso (criptografado). **Impacto:** sem o `walletId` salvo, o **split** da comissão para o proprietário não acontece. **Ação:** salvar `walletId` no perfil/conta do proprietário ao aprovar.
3. **Bucket de Storage.** O upload de fotos usa o bucket `property-photos` no Supabase Storage — **precisa ser criado** (público). Sem ele, cai no preview local (demo).
4. **Google Places legado.** Usa `maps/api/place/nearbysearch/json` (Places API legada). Funciona hoje, mas o Google está migrando para "Places API (New)" — pode exigir atualização no futuro.
5. **PostHog não implementado.** Documentado mas sem código — definir se entra agora ou some do `.env.example`.

**Pontos bons:** todas as integrações têm flag `isXConfigured()`, fallback de demonstração e as rotas de API tratam erro (400 de validação + 500 com mensagem) — a arquitetura degrada com segurança.

## Prioridade sugerida para o GO
1. Supabase (com Storage) → 2. Mapbox → 3. Resend + SMTP do Auth → 4. Asaas (**+ corrigir o webhook, achado 1**) → 5. CAF e ZapSign quando for ativar verificação/contrato reais.
