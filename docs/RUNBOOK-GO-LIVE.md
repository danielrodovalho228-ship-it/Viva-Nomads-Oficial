# Runbook de Go-Live — passos no painel (Supabase + Vercel)

> Tudo aqui é **ação no painel** (não é código). Aplique na ordem. Os blocos de
> SQL são **idempotentes** — pode rodar de novo sem medo. Última revisão a partir
> dos PRs #51–#59 (fluxo de garantia + serviços + correções do QA).

---

## 1. Banco — rodar no **Supabase → SQL Editor**

Cole o bloco inteiro abaixo e execute. Ele faz duas coisas: (A) cria o catálogo
de garantias/serviços (migração 0014) e (B) promove o super admin.

> Alternativa para (A): se você usa `supabase db push` no CLI, a migração
> `supabase/migrations/0014_guarantees_catalog.sql` já está no repositório e será
> aplicada por lá. O bloco abaixo é o mesmo conteúdo, para colar direto no painel.

```sql
-- ════════════════════════════════════════════════════════════════════
-- (A) Catálogo de Garantias locatícias e Serviços adicionais (0014)
-- ════════════════════════════════════════════════════════════════════
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
create policy "catálogo de garantias é público" on public.garantias
  for select using (true);

drop policy if exists "catálogo de serviços é público" on public.servicos_adicionais;
create policy "catálogo de serviços é público" on public.servicos_adicionais
  for select using (true);

-- Aqui Resolve ATIVA no MVP (migração 0015): serviços selecionáveis, opcionais.
update public.servicos_adicionais
set status = 'ativo'
where id in ('assistencia_24h', 'plano_manutencao');

-- Modalidades de garantia aceitas por imóvel (migração 0016) — só preferência
-- de aceite, não muda o caminho do dinheiro. Idempotente.
alter table public.properties
  add column if not exists garantias_aceitas text[] not null default '{}';

-- ════════════════════════════════════════════════════════════════════
-- (B) Promover o super admin (papel lido pelo proxy.ts a partir de profiles)
-- ════════════════════════════════════════════════════════════════════
update public.profiles p
set role = 'admin'
from auth.users u
where u.email = 'dtrodovalho40@gmail.com'
  and p.id = u.id;
```

### Conferência (rode depois)

```sql
-- Catálogo populado?
select id, status from public.garantias order by id;
select id, status from public.servicos_adicionais order by id;

-- Papéis corretos? Esperado: dtrodovalho40 = admin; danieltomazrodovalho = tenant
select u.email, p.role
from public.profiles p
join auth.users u on u.id = p.id
where u.email in ('dtrodovalho40@gmail.com', 'danieltomazrodovalho@gmail.com');
```

> **Se o `update` de admin não afetar nenhuma linha** (conta criada antes do
> trigger `handle_new_user`, sem linha em `profiles`), rode o insert abaixo e
> repita o `update`:
>
> ```sql
> insert into public.profiles (id, full_name, email, role)
> select u.id, coalesce(u.raw_user_meta_data->>'full_name', u.email), u.email, 'admin'
> from auth.users u
> where u.email = 'dtrodovalho40@gmail.com'
> on conflict (id) do update set role = 'admin';
> ```

---

## 2. E-mail — **Supabase → Authentication**

Necessário para os casos 1, 2 e 5 do roteiro de QA de autenticação (o e-mail de
confirmação precisa **chegar**).

- [ ] **Authentication → Providers → Email**: confirmar que *Confirm email* está
      **ligado** (se a sua decisão for exigir confirmação).
- [ ] **Authentication → Emails → SMTP Settings**: configurar **Custom SMTP** com
      remetente `@vivanomads.com.br` (ex.: Resend), com **SPF** e **DKIM** do
      domínio publicados no DNS. Sem isso o e-mail cai em spam ou não sai.
- [ ] **Authentication → URL Configuration**: *Site URL* = `https://vivanomads.com.br`
      e *Redirect URLs* incluindo `https://vivanomads.com.br/auth/callback` e
      `https://vivanomads.com.br/auth/reset`.
- [ ] Teste real: criar conta com um e-mail seu e confirmar que o link chega e
      ativa a conta.

---

## 3. Ambiente — **Vercel → Project → Settings → Environment Variables**

- [ ] `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` presentes em
      **Production** (sem elas, a app roda em modo demonstração).
- [ ] `NEXT_PUBLIC_SITE_URL=https://vivanomads.com.br`.
- [ ] `NEXT_PUBLIC_GARANTIDOR_DIGITAL_ATIVO=false` — **mantém FALSE no lançamento**.
      Só vire `true` **quando um parceiro de garantia confirmar**.
- [ ] `NEXT_PUBLIC_GARANTIDOR_PARCEIRO_NOME=` — deixe **vazio**. Só preencha junto
      com a flag, quando o parceiro existir (ou deixe o nome vir do catálogo no
      Supabase).
- [ ] Após mexer em qualquer env, **Redeploy** para o build novo pegar os valores.

> Referência completa das variáveis: `.env.example` no repositório.

---

## 4. Quando ligar o garantidor digital (no futuro, com parceiro)

1. No Supabase, atualizar o catálogo:
   ```sql
   update public.garantias
   set status = 'ativo', parceiro_nome = 'NOME DO PARCEIRO'
   where id = 'garantidor_digital';
   ```
2. Na Vercel, `NEXT_PUBLIC_GARANTIDOR_DIGITAL_ATIVO=true` (e, se quiser forçar o
   nome pela env em vez do catálogo, `NEXT_PUBLIC_GARANTIDOR_PARCEIRO_NOME=NOME`).
3. **Redeploy**. O slot "Em breve" vira selecionável **sem mudança de código**.

---

### Resumo do que NÃO é mais necessário mexer (já está no código/produção)
- Fluxo de garantia (seleção única, trilha por prazo, regra de ouro), serviços
  adicionais, feature flag, painel do garantidor e os 2 bugs do QA: **mergeados**.
- Calculadora de planos e limpeza de jargão: **em produção**.
