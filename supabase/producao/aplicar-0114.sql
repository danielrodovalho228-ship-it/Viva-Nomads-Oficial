-- Viva Nomads — aplicar 0114 (leads do formulário /empresas, ordem cdef67f8 item 3).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0114_rollback.sql.
begin;
set local lock_timeout = '5s';

create table if not exists public.leads_empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 200),
  empresa text not null check (char_length(empresa) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  volume_ano text check (volume_ano is null or char_length(volume_ano) <= 100),
  mensagem text check (mensagem is null or char_length(mensagem) <= 2000),
  criado_em timestamptz not null default now()
);
create index if not exists leads_empresas_criado_idx on public.leads_empresas (criado_em desc);

alter table public.leads_empresas enable row level security;
revoke all on public.leads_empresas from anon, authenticated;
grant select on public.leads_empresas to authenticated;

drop policy if exists leads_empresas_admin_select on public.leads_empresas;
create policy leads_empresas_admin_select on public.leads_empresas
  for select to authenticated using (public.is_admin());

comment on table public.leads_empresas is 'Contatos comerciais do formulário /empresas. Só admin lê; a rota grava com service_role.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261014000114', '0114_leads_empresas',
       array['-- conteúdo em supabase/migrations/0114_leads_empresas.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261014000114');
commit;
