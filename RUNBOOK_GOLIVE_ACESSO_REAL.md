# 🚦 RUNBOOK — Ativar o acesso real em produção (Viva Nomads)

> O código de segurança já está correto e em `main`. Os achados do QA (C1/C2/C3)
> são sintomas de **produção rodando em modo demonstração** — o Supabase não está
> ativo no build de produção. Este runbook ativa o acesso real. Passos de
> credencial/infra são **seus** (Daniel); o Claude Code não opera nas chaves.

---

## 0. Confirmar o problema (10 segundos)

Abra: **`https://vivanomads.com.br/api/health`**

- `"integrations": { "supabase": false }` → **confirma**: produção em modo demo. Siga abaixo.
- `"supabase": true` → o problema é outro (migration/RLS); me avise para investigar.

---

## 1. Vercel — variáveis de ambiente em PRODUÇÃO

Painel da Vercel → projeto **viva-nomads-oficial** → **Settings → Environment Variables**.

Para cada variável abaixo, **marque o ambiente `Production`** (não só Preview/Development):

| Nome | Valor | Onde achar no Supabase |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave `anon` `public` | Supabase → Settings → API → Project API keys → `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` *(se houver uso server-side)* | chave `service_role` (secreta) | mesma tela → `service_role` ⚠️ NUNCA prefixar com `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | `https://vivanomads.com.br` | — |

> ⚠️ As `NEXT_PUBLIC_*` entram no bundle em **build time**. Definir agora **não**
> muda o site no ar até um **novo build** (passo 2). Por isso o site continua em
> demo mesmo se você já tinha configurado.

---

## 2. Vercel — REDEPLOY de produção (o passo mais esquecido)

Vercel → **Deployments** → encontre o deploy de **Production** mais recente →
menu `⋯` → **Redeploy** → confirme com **"Use existing Build Cache" DESMARCADO**
(força rebuild com as novas envs).

Alternativa: faça qualquer commit em `main` para disparar um deploy novo.

Ao terminar, confira em **Deployments** que o **Production** aponta para o commit
mais novo de `main` (atualmente o topo de `main`, com o guard de admin).

---

## 3. Supabase — aplicar as migrations no banco de PRODUÇÃO

As políticas RLS e a função `is_admin()` vivem nas migrations do repo
(`supabase/migrations/`). Aplique-as ao banco de produção.

**Opção A — CLI (recomendado):**
```bash
supabase link --project-ref <ref>     # uma vez
supabase db push                       # aplica as migrations pendentes (inclui 0009)
```

**Opção B — SQL Editor:** Supabase → **SQL Editor** → cole e rode o conteúdo de
`supabase/migrations/0009_access_real_admin_rls.sql` (e confirme que 0001–0008 já
foram aplicadas; em projeto novo, rode todas em ordem).

Verifique depois (SQL Editor):
```sql
select proname from pg_proc where proname = 'is_admin';          -- deve retornar 1 linha
select tablename, policyname from pg_policies where schemaname='public'
  and policyname ilike 'admin%';                                  -- deve listar as policies de admin
```

---

## 4. Supabase — criar/definir o ADMIN

Crie seu usuário (via tela `/auth` do site, já em modo real) e então marque o papel:

```sql
update public.profiles set role = 'admin' where email = 'SEU_EMAIL_AQUI';
```
> Sem uma linha em `profiles` com `role='admin'`, o próprio guard te manda para
> `/dashboard`.

---

## 5. Reconfirmar e re-testar (roteiro dos 3 papéis)

1. `https://vivanomads.com.br/api/health` → `supabase: true`. ✅
2. Os imóveis `ube-001/002/003` **somem** da busca pública (eram dados de demo). ✅
3. **Admin** (você): loga, acessa `/admin`. ✅
4. **Proprietário** (outra conta): tenta `/admin` **pela URL direta** → é redirecionado
   para `/dashboard`. Só vê os próprios imóveis/leads. ✅
5. **Inquilino** (outra conta): tenta `/admin` pela URL → barrado. Só vê os próprios
   favoritos/candidaturas. ✅
6. Proprietário A **não** vê dados do proprietário B (isolamento por RLS). ✅

Se algum passo falhar **com `supabase: true`**, me mande o que aconteceu (qual papel,
qual URL, o que apareceu) que eu investigo no código.

---

## Resumo de responsabilidades
- **Código (Claude/feito):** auth SSR por cookies, guard de `/admin` no middleware **e** na
  página (server-side), RLS de admin (0009), demo-off na camada pública.
- **Infra (Daniel/este runbook):** envs de produção + redeploy + aplicar migrations +
  definir admin. **Sem o passo 2 (redeploy), nada disso entra no ar.**
