-- Viva Nomads — aplicar 0092 (persona e memória dos agentes da Central). Idempotente.
-- Rollback: supabase/producao/rollback/0092_rollback.sql
-- Só acrescenta (coluna, tabela, política). Sem DROP de dados.
begin;
set local lock_timeout = '5s';

alter table public.agentes add column if not exists persona text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agentes_persona_tamanho') then
    alter table public.agentes add constraint agentes_persona_tamanho check (persona is null or char_length(persona) <= 4000);
  end if;
end;
$$;

create table if not exists public.agentes_memoria (
  id uuid primary key default gen_random_uuid(),
  agente_slug text not null references public.agentes(slug) on delete cascade,
  fato text not null check (char_length(fato) between 1 and 500),
  criado_em timestamptz not null default now()
);
create index if not exists agentes_memoria_slug_data on public.agentes_memoria (agente_slug, criado_em desc);

alter table public.agentes_memoria enable row level security;
revoke all on public.agentes_memoria from anon, authenticated;
grant select, insert, delete on public.agentes_memoria to authenticated;

drop policy if exists agentes_memoria_admin_all on public.agentes_memoria;
create policy agentes_memoria_admin_all on public.agentes_memoria for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261008000092', '0092_agentes_persona_memoria',
       array['-- conteúdo em supabase/migrations/0092_agentes_persona_memoria.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261008000092');
commit;

-- Conferência (só leitura):
-- select has_table_privilege('anon', 'public.agentes_memoria', 'SELECT') as anon_le;  -- false
-- select policyname from pg_policies where tablename = 'agentes_memoria';
