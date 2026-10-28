-- Viva Nomads — aplicar 0250 (interesse em espaço de trabalho). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0250_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.profiles add column if not exists espaco_trabalho_oferta text;
alter table public.profiles add column if not exists espaco_trabalho_procura text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_espaco_trabalho_chk') then
    alter table public.profiles add constraint profiles_espaco_trabalho_chk
      check (
        (espaco_trabalho_oferta is null or espaco_trabalho_oferta in ('nao', 'sala', 'consultorio', 'clinica', 'outro'))
        and (espaco_trabalho_procura is null or espaco_trabalho_procura in ('nao', 'coworking', 'sala_consultorio'))
      );
  end if;
end $$;

grant update (espaco_trabalho_oferta, espaco_trabalho_procura) on public.profiles to authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261028000250', '0250_espaco_trabalho_interesse', array['-- conteúdo em supabase/migrations/0250_espaco_trabalho_interesse.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028000250');
commit;
