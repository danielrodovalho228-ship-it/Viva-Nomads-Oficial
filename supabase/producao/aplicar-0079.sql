-- Viva Nomads — aplicar 0079 (plano Gestor no banco) em produção.
-- SQL Editor ou ferramenta do Supabase: nenhum comando gera NOTICE. Reaplicar é seguro.
-- Conteúdo = supabase/migrations/0079_plano_gestor.sql + registro no histórico.
begin;

do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'plan_type' and e.enumlabel = 'gestor'
  ) then
    alter type public.plan_type add value 'gestor';
  end if;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261007000079', '0079_plano_gestor',
       array['-- conteúdo em supabase/migrations/0079_plano_gestor.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261007000079');

commit;

-- Conferência (só leitura): deve mostrar free,essential,pro,gestor e 1 linha no histórico.
select string_agg(enumlabel, ',' order by enumsortorder) as planos from pg_enum where enumtypid = 'public.plan_type'::regtype;
select version, name from supabase_migrations.schema_migrations where version = '20261007000079';
