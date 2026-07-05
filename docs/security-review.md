# Laudo de segurança — Viva Nomads

Revisão defensiva do site (código + banco). Data: 2026-07-05. Escopo: autenticação/
sessão, autorização (RLS), rotas de API, XSS/injeção, exposição de segredos,
cabeçalhos, e a "regra de ouro" (dinheiro).

## Resumo executivo

O núcleo está **sólido**: RLS bem desenhada (dados isolados por usuário), segredos
só no servidor, rotas de teste bloqueadas por padrão, e os provedores de pagamento
(Asaas/CAF/Google) operam em **modo demonstração** enquanto as chaves não estão
configuradas — o que limita a exposição atual. Corrigi **2 itens ao vivo** e listo
**itens a endurecer antes do go-live de pagamentos**.

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 1 | XSS armazenado no JSON-LD (título/descrição do imóvel) | **Média** (ao vivo) | ✅ **Corrigido** |
| 2 | Open redirect via `?redirect=/\evil` (barra invertida) | Baixa (ao vivo) | ✅ **Corrigido** |
| 3 | Rotas `/api` de pagamento/verificação **sem autenticação** | **Alta (latente)** | ⚠️ Ação no go-live |
| 4 | Proxy Google Places aberto (abuso de cota) | Média (latente) | ⚠️ Ação no go-live |
| 5 | `email_existe` permite enumerar e-mails | Baixa (aceita) | ℹ️ Mitigar (rate limit) |
| 6 | Separação proprietário/inquilino é client-side | Informativo | ✅ Dados cobertos por RLS |
| 7 | CSP em modo **report-only** (não bloqueia) | Baixa | ℹ️ Recomendação |

---

## Corrigidos nesta revisão

### 1. XSS armazenado no JSON-LD ✅
`property-json-ld.tsx` injetava `JSON.stringify(json)` (que inclui **título e
descrição escritos pelo proprietário**) dentro de um `<script>` via
`dangerouslySetInnerHTML`. `JSON.stringify` **não** escapa `<`, então um título como
`</script><img src=x onerror=...>` fecharia a tag e executaria script na página
pública do imóvel (XSS armazenado, afeta todos os visitantes daquela página).
**Correção:** escapamos `<`, `>`, `&` para `</>/&`.

### 2. Open redirect (barra invertida) ✅
O destino pós-login (`?redirect=`) bloqueava `//evil` mas não `/\evil` — que alguns
navegadores tratam como URL protocolo-relativo (externo). **Correção:** só aceita
caminho cujo 2º caractere não seja `/` nem `\`.

---

## A endurecer ANTES do go-live de pagamentos (latente)

### 3. Rotas `/api` privilegiadas sem autenticação — **prioridade alta**
Estas rotas fazem `POST` sem checar sessão:
- `/api/subconta` — cria subconta Asaas (walletId/apiKey).
- `/api/comissao`, `/api/assinatura` — criam cobranças (Asaas, com split).
- `/api/caf/verify` — dispara verificação de identidade (dados de CPF; custo).
- `/api/nfse`, `/api/contrato` — emissão/geração de documentos.

**Hoje o risco é baixo** porque, sem `ASAAS_API_KEY`/`CAF_API_TOKEN`, elas retornam
**dados simulados** (não cobram, não criam nada real). **Mas** no momento em que
essas chaves forem configuradas, qualquer pessoa poderá disparar cobranças/subcontas/
verificações. **Recomendação:** antes de ligar os provedores, exigir sessão
(`supabase.auth.getUser()`) e autorização por papel (ex.: só o próprio proprietário/
admin) em cada uma, além de validar os valores no servidor (não confiar no `plan`/
`firstMonthRent` vindos do corpo).

### 4. Proxy do Google Places aberto — média
`/api/places/autocomplete` e `/api/places/distances` fazem proxy à API do Google com
a chave do servidor. Sem `GOOGLE_MAPS_API_KEY` retornam vazio (ok hoje). Com a chave,
viram **proxy aberto** — terceiros podem consumir sua cota. **Recomendação:** exigir
sessão ou limitar por origem/rate-limit ao configurar a chave.

---

## Aceitos / informativos

### 5. Enumeração de e-mail (`email_existe`)
A função (migração 0031) foi **pedida** para melhorar o acesso (distinguir "sem conta"
de "senha errada"). Ela permite a terceiros descobrir se um e-mail tem conta. É um
trade-off conhecido de usabilidade × privacidade. **Mitigação sugerida:** rate limit
no endpoint de login e/ou só chamar a função após uma falha real de senha (já é o
caso). Se um dia priorizar anti-enumeração, remover a função.

### 6. Separação proprietário/inquilino é client-side — sem vazamento
O redirecionamento owner⇄tenant acontece no cliente (UX). **Isso não é falha de
dados**: o acesso real é governado por **RLS** — verificado nesta revisão:
- `messages`: só `sender`/`receiver`. `leads`: só `owner`/`tenant`. `profiles`: só o
  próprio (+admin). `pedidos_moradia`: só o inquilino dono (proprietários usam a view
  `pedidos_publicos`, que **não** expõe identidade). `contratos`/`pagamentos_bloco`:
  só as partes. Login e papel **admin** são barrados no **servidor** (proxy).

### 7. CSP em report-only
`next.config.ts` envia HSTS e `X-Frame-Options: DENY` (bom), mas a CSP está em
`Content-Security-Policy-Report-Only` (só reporta, não bloqueia). **Recomendação:**
depois de validar que nada legítimo é bloqueado, promover para `Content-Security-Policy`
(enforcing) para uma camada extra anti-XSS.

---

## Verificado e OK

- **Segredos:** `SERVICE_ROLE_KEY`, `RESEND_API_KEY`, chaves de provedores — só no
  servidor. Nenhum `.env` real versionado; nenhuma chave hardcoded no código.
- **Rotas de teste** (`/api/test-email`, `/api/test-lead`): bloqueadas por padrão
  (403) — exigem `TEST_ROUTES_KEY`.
- **Webhook Asaas:** valida `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`.
- **Injeção SQL:** consultas via Supabase são parametrizadas; sem SQL cru concatenado.
- **`innerHTML` do mapa:** conteúdo estático (SVG), sem dado do usuário.
- **Regra de ouro:** a plataforma não retém valores; pagamentos são declaratórios/
  via provedor externo — sem custódia de dinheiro no código.
- **Sessão:** cliente Supabase é singleton (sem deadlock); guarda espera a
  conferência da sessão (sem "entra e sai").

---

## Recomendações priorizadas

1. **Antes de ligar Asaas/CAF/Google:** autenticar e autorizar as rotas do item 3 e 4.
2. **Rate limit** no login/`email_existe` (item 5).
3. **Promover a CSP** para enforcing (item 7).
4. Revisar periodicamente as políticas RLS ao criar novas tabelas (padrão já bom).
