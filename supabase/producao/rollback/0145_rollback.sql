-- Rollback da 0145: volta auth.uid()/role()/jwt() sem o (select ...) nas políticas (só a forma; mesmo significado).
begin;
do $$
declare
  p record;
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~* '\(\s*select\s+auth\.(uid|role|jwt)\(\)\s*(as \w+)?\s*\)'
         or coalesce(with_check, '') ~* '\(\s*select\s+auth\.(uid|role|jwt)\(\)\s*(as \w+)?\s*\)')
  loop
    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then
      sql := sql || ' using (' || regexp_replace(p.qual, '\(\s*select\s+(auth\.(uid|role|jwt)\(\))\s*(as \w+)?\s*\)', '\1', 'gi') || ')';
    end if;
    if p.with_check is not null then
      sql := sql || ' with check (' || regexp_replace(p.with_check, '\(\s*select\s+(auth\.(uid|role|jwt)\(\))\s*(as \w+)?\s*\)', '\1', 'gi') || ')';
    end if;
    execute sql;
  end loop;
end $$;
delete from supabase_migrations.schema_migrations where version = '20261017000145';
commit;
