-- Viva Nomads — 0178: catálogo de serviços do morador (complemento da ordem 521c5af7). Idempotente.
-- Rollback: supabase/producao/rollback/0178_rollback.sql.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
begin;
set local lock_timeout = '5s';

-- 1. Linha curta do cartão do catálogo (a descrição longa continua para o detalhe).
alter table public.servicos_adicionais add column if not exists resumo text
  check (resumo is null or char_length(resumo) <= 90);

-- 2. Nomes com acento (em produção estavam "Assistencia 24h" e "Plano de manutencao").
update public.servicos_adicionais set nome = 'Assistência 24h', resumo = coalesce(resumo, 'Chaveiro, encanador e elétrica a qualquer hora.')
 where id = 'assistencia_24h';
update public.servicos_adicionais set nome = 'Plano de manutenção' where id = 'plano_manutencao';

-- 3. Categorias aprovadas do inquilino: pagas pelo inquilino, "em breve" enquanto não houver parceiro aprovado.
--    Se a linha já existir, só nome, resumo, categoria e quem paga são acertados (o status e o parceiro ficam).
insert into public.servicos_adicionais (id, nome, categoria, quem_paga, parceiro_nome, status, descricao, resumo)
values
  ('limpeza', 'Limpeza', 'assistencia_inquilino', 'inquilino', null, 'em_breve',
   'Limpeza de entrada, periódica e de saída, com prestador parceiro independente. Você contrata e paga direto ao prestador; a Viva não recebe esse valor nem executa o serviço.',
   'Entrada, periódica e saída.'),
  ('lavanderia_enxoval', 'Lavanderia e enxoval', 'assistencia_inquilino', 'inquilino', null, 'em_breve',
   'Lavagem de roupas e de cama, mesa e banho, com prestador parceiro independente. Você contrata e paga direto ao prestador; a Viva não recebe esse valor nem executa o serviço.',
   'Roupas, cama, mesa e banho.'),
  ('frete_mudanca', 'Frete e mudança leve', 'assistencia_inquilino', 'inquilino', null, 'em_breve',
   'Frete de malas, caixas e poucos móveis, com prestador parceiro independente. Você contrata e paga direto ao prestador; a Viva não recebe esse valor nem executa o serviço.',
   'Malas, caixas e poucos móveis.')
on conflict (id) do update
  set nome = excluded.nome, resumo = excluded.resumo, categoria = excluded.categoria, quem_paga = excluded.quem_paga;
update public.servicos_adicionais set quem_paga = 'inquilino', categoria = 'assistencia_inquilino' where id = 'assistencia_24h';

-- 4. "Avise-me quando estiver disponível", por categoria (como o aviso de fotógrafo da 0162). Uma linha por pessoa e
--    categoria; sem contato na tabela (vem do perfil). RLS: a própria pessoa grava e lê a sua; o admin lê todas.
create table if not exists public.interesse_servico (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  servico_id text not null references public.servicos_adicionais (id) on delete cascade,
  criado_em timestamptz not null default now(),
  avisado_em timestamptz,
  unique (user_id, servico_id)
);
create index if not exists interesse_servico_ranking on public.interesse_servico (servico_id);

alter table public.interesse_servico enable row level security;
revoke all on public.interesse_servico from public, anon, authenticated;
grant select, insert on public.interesse_servico to authenticated;
grant all on public.interesse_servico to service_role;

drop policy if exists interesse_servico_proprio_insere on public.interesse_servico;
create policy interesse_servico_proprio_insere on public.interesse_servico for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists interesse_servico_le on public.interesse_servico;
create policy interesse_servico_le on public.interesse_servico for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000178', '0178_servicos_catalogo_inquilino',
       array['-- conteúdo em supabase/migrations/0178_servicos_catalogo_inquilino.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000178');
commit;
