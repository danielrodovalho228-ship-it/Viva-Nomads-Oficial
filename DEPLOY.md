# Deploy — Viva Nomads (Vercel + domínio vivanomads.com.br)

Guia passo a passo para colocar a plataforma no ar.

> **Caminho mínimo viável (tira do demo e põe no ar):** basta **(1)** criar o
> projeto Supabase e rodar as 48 migrations, **(2)** deploy na Vercel com as
> **4 variáveis obrigatórias** (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
> `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) e **(3)** apontar
> o domínio. O resto (Asaas, Mapbox, CAF, ZapSign, WhatsApp, IA) são integrações
> que podem entrar depois — sem elas, essas features ficam inativas, mas o núcleo
> (contas, anúncios, candidatura, moderação) funciona.

---

## 1. Pré-requisitos

- Conta na [Vercel](https://vercel.com)
- Projeto no [Supabase](https://supabase.com) (Postgres + Auth + Storage)
- Domínio `vivanomads.com.br` (registrado, ex.: Registro.br)
- (Opcional, para ativar tudo) contas: Asaas, Mapbox, CAF, ZapSign

---

## 2. Banco de dados (Supabase)

1. Crie um projeto no Supabase (região **South America / São Paulo**).
2. No SQL Editor, rode **TODAS** as migrations de `supabase/migrations/` **em ordem numérica**, de `0001_initial_schema.sql` até `0048_push_tokens.sql` (48 arquivos). Não pule nenhuma.
   - **Críticas para o piloto** (moderação de documentos — o "portão de publicar"): **`0042_document_moderation.sql`** e **`0044_document_conference.sql`**. Sem elas, publicar anúncio não exige documento aprovado (o furo que você quer evitar).
   - **Atalho:** `supabase/producao/aplicar-piloto.sql` reúne 0042+0044+0046+0047 na ordem certa (detalhes em `supabase/producao/CHECKLIST.md`). ⚠️ O `UPDATE` de requeue da 0044 só deve rodar uma vez.
   - **Confira depois:** `npm run check:migracoes` (apontando as envs de produção) mostra ✅/❌ por migração crítica — exit 1 se faltar moderação.
   - (opcional) `supabase/seed.sql` — depois de criar um usuário proprietário.
3. Em **Authentication → Providers**, ative **Email** e **Google** (OAuth).
   - Em Google, configure o redirect: `https://vivanomads.com.br/auth/callback`.
4. Pegue em **Project Settings → API**: `Project URL` e `anon public key`.

---

## 3. Deploy na Vercel

1. **Import Project** → conecte o repositório do GitHub.
2. Framework: **Next.js** (detectado automaticamente). `vercel.json` já define a
   região **gru1 (São Paulo)** e o CORS das rotas `/api/*`.
3. Em **Environment Variables**, adicione (ver tabela abaixo).
4. **Deploy**. A Vercel gera uma URL `*.vercel.app` — teste antes de apontar o domínio.

### Variáveis de ambiente

| Variável | Obrigatória | Observação |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | sim | `https://vivanomads.com.br` |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | chave anônima |
| `SUPABASE_SERVICE_ROLE_KEY` | recomendada | operações server-side |
| `ASAAS_API_KEY` | p/ pagamento | assinatura PIX/boleto/cartão |
| `ASAAS_WEBHOOK_TOKEN` | p/ pagamento | valida o webhook |
| `ASAAS_ENV` | p/ pagamento | `sandbox` ou `production` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | p/ mapas | token público Mapbox |
| `CAF_API_TOKEN` / `CAF_TEMPLATE_ID` | p/ verificação | laudo de inquilino |
| `ZAPSIGN_API_TOKEN` | p/ contrato | geração via ZapSign |

> Sem as chaves opcionais, a app sobe e funciona em **modo demonstração**; cada
> recurso ativa sozinho quando a chave correspondente é preenchida.

Depois do deploy, configure o webhook no Asaas apontando para
`https://vivanomads.com.br/api/webhooks/asaas` (header `asaas-access-token` =
`ASAAS_WEBHOOK_TOKEN`).

---

## 4. Domínio vivanomads.com.br

1. Na Vercel: **Project → Settings → Domains → Add** → `vivanomads.com.br`
   (adicione também `www.vivanomads.com.br`).
2. No painel do **Registro.br** (DNS), configure:

   | Tipo | Nome | Valor |
   |---|---|---|
   | `A` | `@` | `76.76.21.21` |
   | `CNAME` | `www` | `cname.vercel-dns.com` |

   > A Vercel mostra os valores exatos na tela de domínios — use os que ela indicar
   > (o IP do registro `A` pode variar). A propagação leva de minutos a algumas horas.
3. A Vercel emite o **certificado SSL** automaticamente. Defina
   `vivanomads.com.br` como **domínio primário** (redireciona o `www`).

---

## 5. Pós-deploy (checklist)

- [ ] `https://vivanomads.com.br/api/health` retorna `ok: true` e mostra quais
      integrações estão ativas.
- [ ] `https://vivanomads.com.br/robots.txt` e `/sitemap.xml` apontam para o domínio.
- [ ] Cadastro/login funcionam (Email + Google).
- [ ] Envie o `sitemap.xml` ao **Google Search Console** (aquisição é orgânica).

---

## 6. Preparado para o app (próximo passo)

A arquitetura já está pronta para um aplicativo móvel no futuro:

- O **backend é o Supabase** (Auth, Postgres, Storage) — um app **Expo / React
  Native** usa o mesmo `@supabase/supabase-js` e as mesmas tabelas/RLS.
- As **rotas `/api/*`** (assinatura, CAF, contrato, health) já têm **CORS liberado**
  (`vercel.json`) para serem consumidas pelo app.
- A lógica de domínio reaproveitável (`src/lib/qualification.ts`, `src/lib/closing.ts`,
  `src/lib/constants.ts`) é TypeScript puro e pode ser extraída para um pacote
  compartilhado (`packages/core`) num monorepo web + app.

Quando for criar o app, o caminho recomendado é um **monorepo** (ex.: Turborepo)
com `apps/web` (este projeto) + `apps/mobile` (Expo) + `packages/core` (tipos e
regras compartilhadas).
