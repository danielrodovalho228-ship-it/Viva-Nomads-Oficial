# Passo a passo de Go-Live — Viva Nomads

> Guia para **executar no painel** (não precisa saber programar). Faça na ordem.
> Onde tiver `[ ]`, marque ao concluir. Se algo não bater com o "resultado
> esperado", **pare e avise o responsável técnico** antes de seguir.

**Tempo estimado:** 30–45 min. **Quem faz:** Daniel (acessos) + time de QA (validação).

---

## Antes de começar — acessos necessários

- [ ] Acesso ao **Supabase** do projeto (https://supabase.com → entrar → projeto Viva Nomads).
- [ ] Acesso à **Vercel** do projeto (https://vercel.com → projeto viva-nomads-oficial).
- [ ] Acesso ao **DNS do domínio** vivanomads.com.br (para o e-mail) — pode ser do seu provedor de domínio.
- [ ] Dois e-mails reais de teste que você consiga abrir (para o time de QA testar cadastro/confirmação).

---

# PARTE 1 — Banco de dados (Supabase)

### Passo 1.1 — Abrir o editor de SQL
1. Entre no Supabase e selecione o projeto **Viva Nomads**.
2. No menu da esquerda, clique em **SQL Editor** (ícone de banco de dados).
3. Clique em **+ New query** (nova consulta).

### Passo 1.2 — Colar e rodar o bloco de SQL
1. Copie **todo** o bloco de SQL abaixo.
2. Cole na área branca do editor.
3. Clique em **Run** (ou aperte Ctrl+Enter / Cmd+Enter).
4. **Resultado esperado:** aparece "Success. No rows returned" (ou similar). Sem texto em vermelho.

```sql
-- (A) Catálogo de garantias + serviços (cria as tabelas e popula)
create table if not exists public.garantias (
  id text primary key,
  nome text not null,
  tipo text not null check (tipo in ('caucao', 'titulo', 'garantidor_digital')),
  prazo_min_dias int not null,
  prazo_max_dias int not null,
  quem_paga text not null check (quem_paga in ('inquilino', 'proprietario')),
  reembolsavel boolean not null default false,
  status text not null check (status in ('ativo', 'em_breve', 'inativo')),
  parceiro_nome text,
  observacao text
);

create table if not exists public.servicos_adicionais (
  id text primary key,
  nome text not null,
  categoria text not null check (categoria in ('assistencia_inquilino', 'manutencao_proprietario')),
  quem_paga text not null check (quem_paga in ('inquilino', 'proprietario')),
  parceiro_nome text,
  status text not null check (status in ('ativo', 'em_breve', 'inativo')),
  descricao text not null
);

insert into public.garantias (id, nome, tipo, prazo_min_dias, prazo_max_dias, quem_paga, reembolsavel, status, parceiro_nome, observacao)
values
  ('caucao', 'Caução', 'caucao', 1, 180, 'inquilino', true, 'ativo', null,
   'Depósito em conta vinculada (locador + locatário), devolvido ao fim. A plataforma registra; nunca recebe nem retém o valor.'),
  ('titulo', 'Título de capitalização', 'titulo', 1, 180, 'inquilino', true, 'ativo', null,
   'Resgatável ao fim do contrato. A plataforma documenta o número do título.'),
  ('garantidor_digital', 'Garantidor digital', 'garantidor_digital', 90, 180, 'inquilino', false, 'em_breve', null, null)
on conflict (id) do nothing;

insert into public.servicos_adicionais (id, nome, categoria, quem_paga, parceiro_nome, status, descricao)
values
  ('assistencia_24h', 'Assistência 24h', 'assistencia_inquilino', 'inquilino', null, 'em_breve',
   'Chaveiro, encanador, elétrica e mais. A plataforma intermedeia e roteia o pagamento ao prestador; não executa o serviço.'),
  ('plano_manutencao', 'Plano de manutenção', 'manutencao_proprietario', 'proprietario', null, 'em_breve',
   'Manutenção preventiva e corretiva do imóvel. A plataforma intermedeia e roteia o pagamento ao prestador; não executa o serviço.')
on conflict (id) do nothing;

alter table public.garantias enable row level security;
alter table public.servicos_adicionais enable row level security;

drop policy if exists "catálogo de garantias é público" on public.garantias;
create policy "catálogo de garantias é público" on public.garantias for select using (true);

drop policy if exists "catálogo de serviços é público" on public.servicos_adicionais;
create policy "catálogo de serviços é público" on public.servicos_adicionais for select using (true);

-- (B) Ativa a Aqui Resolve (serviços ficam selecionáveis)
update public.servicos_adicionais
set status = 'ativo'
where id in ('assistencia_24h', 'plano_manutencao');

-- (C) Coluna de modalidades de garantia aceitas por imóvel
alter table public.properties
  add column if not exists garantias_aceitas text[] not null default '{}';

-- (D) Promove o super admin
update public.profiles p
set role = 'admin'
from auth.users u
where u.email = 'dtrodovalho40@gmail.com'
  and p.id = u.id;
```

### Passo 1.3 — Conferir se deu certo
1. Apague o conteúdo do editor e cole o bloco de conferência abaixo. Clique em **Run**.

```sql
select id, status from public.garantias order by id;
select id, status from public.servicos_adicionais order by id;
select u.email, p.role
from public.profiles p
join auth.users u on u.id = p.id
where u.email in ('dtrodovalho40@gmail.com', 'danieltomazrodovalho@gmail.com');
```

2. **Resultado esperado:**
   - `garantias`: 3 linhas — `caucao = ativo`, `titulo = ativo`, `garantidor_digital = em_breve`.
   - `servicos_adicionais`: 2 linhas — ambos `ativo`.
   - última consulta: `dtrodovalho40@gmail.com` → **admin** e `danieltomazrodovalho@gmail.com` → **tenant**.

- [ ] Passo 1 concluído (banco populado + admin promovido).

> **Se `dtrodovalho40@gmail.com` NÃO aparecer como admin** (a conta foi criada
> antes e não tem linha em `profiles`), rode este complemento e repita a
> conferência:
>
> ```sql
> insert into public.profiles (id, full_name, email, role)
> select u.id, coalesce(u.raw_user_meta_data->>'full_name', u.email), u.email, 'admin'
> from auth.users u
> where u.email = 'dtrodovalho40@gmail.com'
> on conflict (id) do update set role = 'admin';
> ```

---

# PARTE 2 — E-mail (Supabase)

> Necessário para o cadastro enviar o e-mail de confirmação. Sem isso, os
> testes de cadastro/confirmação do QA falham.

### Passo 2.1 — Confirmar a opção de confirmação de e-mail
1. No Supabase, menu esquerdo → **Authentication** → **Providers** → **Email**.
2. Verifique se **Confirm email** está **ligado** (se a decisão for exigir confirmação).
- [ ] Confirm email conferido.

### Passo 2.2 — Configurar o envio (SMTP)
1. **Authentication** → **Emails** → **SMTP Settings**.
2. Ative **Custom SMTP** e preencha com um provedor (ex.: Resend), usando remetente **@vivanomads.com.br**.
3. No **DNS do domínio**, publique os registros **SPF** e **DKIM** que o provedor indicar (senão o e-mail vai para spam ou não sai).
- [ ] SMTP configurado e SPF/DKIM publicados.

### Passo 2.3 — Endereços de retorno
1. **Authentication** → **URL Configuration**.
2. **Site URL:** `https://vivanomads.com.br`
3. Em **Redirect URLs**, adicione (uma por linha):
   - `https://vivanomads.com.br/auth/callback`
   - `https://vivanomads.com.br/auth/reset`
- [ ] URLs configuradas.

---

# PARTE 3 — Ambiente (Vercel)

### Passo 3.1 — Conferir/definir variáveis
1. Na Vercel, abra o projeto → **Settings** → **Environment Variables** (ambiente **Production**).
2. Garanta que existem:
   - `NEXT_PUBLIC_SUPABASE_URL` (do Supabase → Project Settings → API)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (idem)
   - `NEXT_PUBLIC_SITE_URL` = `https://vivanomads.com.br`
   - `NEXT_PUBLIC_GARANTIDOR_DIGITAL_ATIVO` = `false`  ← **mantenha false no lançamento**
   - `NEXT_PUBLIC_GARANTIDOR_PARCEIRO_NOME` = (deixe **vazio**)
- [ ] Variáveis conferidas.

### Passo 3.2 — Republicar
1. Vá em **Deployments** → no último deploy, menu **⋯** → **Redeploy** (para o build pegar as variáveis).
- [ ] Redeploy feito.

---

# PARTE 4 — Validação pelo time de QA (no site em produção)

> Abrir **https://vivanomads.com.br**. Cada item, marque OK ou Falhou + print se falhar.

### 4.1 — Autenticação
- [ ] Cadastrar como **Inquilino** com e-mail real novo → conta criada + e-mail de confirmação chega.
- [ ] Cadastrar como **Proprietário** com outro e-mail real → idem, papel proprietário.
- [ ] Tentar cadastrar de novo com um e-mail **já usado** → mensagem "Este e-mail já possui uma conta…" (não erro genérico).
- [ ] Login com **senha errada** → "E-mail ou senha incorretos." (sem dizer se o e-mail existe).
- [ ] Recuperar senha → e-mail chega, link abre "Criar nova senha", senha nova funciona, antiga não.

### 4.2 — Fechamento: garantia, caução e serviços (logado como proprietário)
- [ ] Abrir **Fechamento** → iniciar verificação → avançar para **Garantia**.
- [ ] A **caução** já vem selecionada; aparece a seção "Como funciona a sua proteção" e a regra de ouro.
- [ ] Selecionar **Título** desmarca a caução (só **uma** garantia pode ficar marcada).
- [ ] O **garantidor digital** aparece como "Em breve" e **não** pode ser selecionado.
- [ ] Na caução, escolher **À vista** e depois **Parcelado** → mostra o valor da parcela. Texto deixa claro que o dinheiro vai para conta vinculada / emissora, **nunca para a plataforma**.
- [ ] Etapa **Serviços** → Assistência 24h e Plano de manutenção aparecem como **Disponível** e são opcionais (dá pra avançar sem marcar).

### 4.3 — Reembolso (logado como proprietário)
- [ ] Abrir **Reembolsos** no menu.
- [ ] Registrar **vistoria de saída** → adicionar um **desconto** (ex.: 300) → o "valor a devolver" diminui.
- [ ] Clicar **Notificar partes e registrar prazo** → aparece a data limite (30 dias).
- [ ] Clicar **Gerar comprovante** → status "reembolso registrado"; o texto diz que **o pagamento é feito pelo locador** e que a plataforma **não transfere valores**.
- [ ] O aviso da **devolução em dobro** (atraso) está visível.

### 4.4 — Cadastro de imóvel (logado como proprietário)
- [ ] Abrir **Meus imóveis → Novo anúncio** e ir até a etapa de preferências.
- [ ] Aparece **"Modalidades de garantia que você aceita"** com caução/título/garantidor, e o aviso de que é só preferência (não muda o caminho do dinheiro).

### 4.5 — Papéis
- [ ] Entrar com **dtrodovalho40@gmail.com** → vê área de proprietário/admin.
- [ ] Entrar com **danieltomazrodovalho@gmail.com** → vê só inquilino, sem admin.

---

# Pronto para o GO?

- [ ] Parte 1 (banco) OK.
- [ ] Parte 2 (e-mail) OK e um e-mail de teste chegou de verdade.
- [ ] Parte 3 (Vercel) OK e redeploy feito.
- [ ] Parte 4 (QA) — todos os itens OK (ou as falhas registradas com print e enviadas ao responsável técnico).

Quando os 4 estiverem marcados, está liberado para o GO. 🚀

---

### Quando (no futuro) um parceiro de garantia confirmar
1. Supabase → SQL Editor:
   ```sql
   update public.garantias
   set status = 'ativo', parceiro_nome = 'NOME DO PARCEIRO'
   where id = 'garantidor_digital';
   ```
2. Vercel → variável `NEXT_PUBLIC_GARANTIDOR_DIGITAL_ATIVO` = `true` → **Redeploy**.
3. O garantidor digital deixa de ser "Em breve" e fica selecionável — sem mexer em código.
