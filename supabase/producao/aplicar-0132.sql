-- Viva Nomads — aplicar 0132 (políticas RLS com (select auth.uid()), ordem 0f66a754 item 3). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0132_rollback.sql.
begin;
set local lock_timeout = '5s';
do $$
declare
  p record;
  novo_using text;
  novo_check text;
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~* '(?<!select )auth\.(uid|role|jwt)\(\)'
         or coalesce(with_check, '') ~* '(?<!select )auth\.(uid|role|jwt)\(\)')
  loop
    novo_using := case when p.qual is null then null
      else regexp_replace(p.qual, '(?<!select )(auth\.(uid|role|jwt)\(\))', '(select \1)', 'gi') end;
    novo_check := case when p.with_check is null then null
      else regexp_replace(p.with_check, '(?<!select )(auth\.(uid|role|jwt)\(\))', '(select \1)', 'gi') end;
    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if novo_using is not null then sql := sql || ' using (' || novo_using || ')'; end if;
    if novo_check is not null then sql := sql || ' with check (' || novo_check || ')'; end if;
    execute sql;
  end loop;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261015000132', '0132_rls_initplan',
       array['-- conteúdo em supabase/migrations/0132_rls_initplan.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261015000132');
commit;
