-- 0145 — Lentidão (ordem 0f66a754, item 3): auth_rls_initplan.
-- As políticas que chamam auth.uid()/auth.role()/auth.jwt() direto reavaliam a função a CADA linha;
-- embrulhada em (select ...) ela roda uma vez por consulta. Só troca a forma da expressão: o significado
-- é o mesmo. Idempotente: o que já está embrulhado não é tocado.
-- Rollback: supabase/producao/rollback/0145_rollback.sql.
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
