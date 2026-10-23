-- Viva Nomads — aplicar 0222 (papel ativo com fonte única — PAPEL-B). Idempotente. Rollback: supabase/producao/rollback/0222_rollback.sql.
begin;
set local lock_timeout = '5s';
alter table public.profiles add column if not exists papel_ativo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_papel_ativo_chk') then
    alter table public.profiles add constraint profiles_papel_ativo_chk
      check (papel_ativo is null or papel_ativo in ('morador', 'proprietario', 'parceiro'));
  end if;
end $$;

grant update (papel_ativo) on public.profiles to authenticated;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023000222', '0222_papel_ativo',
       array['-- conteúdo em supabase/migrations/0222_papel_ativo.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023000222');
commit;
