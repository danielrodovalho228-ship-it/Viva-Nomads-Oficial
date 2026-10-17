-- Viva Nomads — aplicar 0151 (parceiros: tipo "mobilia"). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0151_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.parceiros_interesse'::regclass
       and conname = 'parceiros_interesse_tipo_check'
       and pg_get_constraintdef(oid) like '%mobilia%'
  ) then
    alter table public.parceiros_interesse drop constraint if exists parceiros_interesse_tipo_check;
    alter table public.parceiros_interesse add constraint parceiros_interesse_tipo_check
      check (tipo in ('fotografo', 'empresa', 'gestor', 'servicos', 'mobilia', 'seguros'));
  end if;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261017000151', '0151_parceiros_tipo_mobilia',
       array['-- conteúdo em supabase/migrations/0151_parceiros_tipo_mobilia.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261017000151');
commit;
