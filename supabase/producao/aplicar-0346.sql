-- Viva Nomads — aplicar 0346 (E614: properties.updated_at, a hora da última gravação da linha, por gatilho). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. NÃO regrava nenhuma linha existente (updated_at fica nulo nelas até a
-- próxima gravação). Rollback: supabase/producao/rollback/0346_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'properties' and column_name = 'updated_at'
  ) then
    alter table public.properties add column updated_at timestamptz;
  end if;
end;
$$;
alter table public.properties alter column updated_at set default now();

comment on column public.properties.updated_at is 'E614: hora da última gravação da linha (gatilho properties_updated_at). null = linha anterior à 0346 que ainda não foi regravada.';

create or replace function public.properties_carimbar_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- Quem grava a hora de propósito é respeitado; em qualquer outra gravação, a hora é a de agora.
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$function$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.properties'::regclass and tgname = 'properties_updated_at' and not tgisinternal
  ) then
    create trigger properties_updated_at
      before update on public.properties
      for each row execute function public.properties_carimbar_updated_at();
  end if;
end;
$$;

-- properties tem grants de coluna (0053): a coluna nova precisa de grant para o dono ler a hora do rascunho.
grant select (updated_at) on public.properties to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name)
select '20261118000346', '0346_properties_updated_at_e614'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261118000346');
commit;
