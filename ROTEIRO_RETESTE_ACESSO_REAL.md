# ✅ ROTEIRO DE RETESTE — Acesso real (3 papéis + 3 blockers)

> Rodar **depois** de: (1) migration `0010` aplicada em produção; (2) build/redeploy
> com as `NEXT_PUBLIC_SUPABASE_*` presentes; (3) `/api/health` → `supabase: connected`.
> Marque cada item ✅/❌. Qualquer ❌ = **NO-GO**; me mande o item e o que apareceu.

---

## 0. Pré-condições (confirmar antes de começar)

- [ ] `https://vivanomads.com.br/api/health` → `"integrations": { "supabase": true }`.
- [ ] Migration `0010` aplicada: no Supabase SQL Editor,
      `select proname from pg_proc where proname='delete_user_account';` → 1 linha.
- [ ] Migration `0009` aplicada: `select proname from pg_proc where proname='is_admin';` → 1 linha.
- [ ] **3 contas de teste** criadas pela tela `/auth` (cada uma com e-mail real para confirmar):
  - **ADMIN** — após criar, rodar no SQL: `update profiles set role='admin' where email='ADMIN@...';`
  - **PROPRIETÁRIO** (owner) — com 1 imóvel publicado.
  - **INQUILINO** (tenant).
- [ ] Um **2º proprietário** (owner B) com 1 imóvel — para testar isolamento entre donos.

---

## 1. 🔴 BLOCKER 1 — login NÃO aceita senha errada

1. Sair (logout). Ir em `/auth` (login).
2. Digitar um e-mail **válido** e uma **senha ERRADA** → Entrar.
   - [ ] **Esperado:** mensagem "E-mail ou senha incorretos." e **NÃO** entra no painel.
3. Mesmo e-mail com a **senha certa** → Entrar.
   - [ ] **Esperado:** entra no `/dashboard`.

> Se a senha errada entrar, o **bundle do cliente está sem as envs** → rebuild/redeploy.

---

## 2. 🔴 BLOCKER 2 — rota protegida no servidor

1. **Deslogado**, digitar na barra de endereço: `vivanomads.com.br/dashboard`.
   - [ ] **Esperado:** redireciona para `/auth` (não abre o painel).
2. Deslogado, tentar `vivanomads.com.br/dashboard/conta` e `…/imoveis`.
   - [ ] **Esperado:** redireciona para `/auth` em ambos.
3. Deslogado, tentar `vivanomads.com.br/admin`.
   - [ ] **Esperado:** redireciona para `/auth` (ou "Acesso negado").

---

## 3. 🔴 BLOCKER 3 — exclusão de conta real (LGPD)

> Use uma conta **descartável** (será apagada de verdade).

1. Logar com a conta descartável → `/dashboard/conta` → "Quero excluir minha conta".
   - [ ] **Etapa 1:** mostra a lista do que será excluído + "Continuar a exclusão".
2. "Continuar a exclusão".
   - [ ] **Etapa 2:** pede **senha atual**; botão "Sim, excluir permanentemente" começa **desabilitado**.
3. Digitar a **senha errada** → confirmar.
   - [ ] **Esperado:** "Senha incorreta. Tente novamente." (não exclui).
4. Digitar a **senha certa** → confirmar.
   - [ ] **Esperado:** desloga e volta para `/home`.
5. No Supabase, conferir que os dados sumiram de verdade:
   - [ ] `select * from auth.users where email='DESCARTAVEL@...';` → 0 linhas.
   - [ ] `select * from profiles where email='DESCARTAVEL@...';` → 0 linhas.
   - [ ] Imóveis/leads daquela conta também sumiram (cascade).

---

## 4. Papéis e isolamento (o coração do acesso real)

### 4.1 ADMIN
- [ ] Loga e acessa `/admin` (lista de checklists/usuários).
- [ ] Consegue ver dados de **vários** proprietários (visão de gestão).

### 4.2 PROPRIETÁRIO (owner A)
- [ ] Acessa `/dashboard` e vê **só os próprios** imóveis em "Meus imóveis".
- [ ] Digita `vivanomads.com.br/admin` na URL → **redireciona para `/dashboard`** (barrado).
- [ ] **Não** vê imóveis/leads do **owner B** em lugar nenhum.

### 4.3 INQUILINO (tenant)
- [ ] Acessa `/dashboard` no modo Inquilino (busca, favoritos, verificação).
- [ ] Digita `vivanomads.com.br/admin` na URL → **barrado**.
- [ ] Não vê telas/dados de proprietário de outras pessoas.

### 4.4 Isolamento entre donos (RLS)
- [ ] Logado como **owner A**, não há nenhuma forma de ver os imóveis/leads do **owner B**
      (nem por URL direta de um id que não é seu).

---

## 5. Dados demo sumiram

- [ ] Na **busca pública**, os imóveis `ube-001/002/003` **não aparecem** (eram demo).
- [ ] Abrir `vivanomads.com.br/imoveis/ube-001` → **404** (não existe no banco real).
- [ ] Os imóveis que aparecem são os **reais** cadastrados pelas contas de teste.

---

## 6. Veredito

- **Todos ✅** → 🟢 **GO** para acesso real.
- **Qualquer ❌** → 🔴 **NO-GO**: me mande o número do item, o papel usado e o que apareceu
  (print ajuda). Eu corrijo o que for código; itens de infra (env/migration/redeploy) eu te
  oriento.

> Lembrete: a plataforma conecta, verifica, documenta e registra — não é locador, fiador,
> garantidor nem executora. Isolamento por papel e proteção no servidor são inegociáveis (LGPD).
