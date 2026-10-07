-- 0088 — Agentes com dados ao vivo: o servidor do site lê QUAIS migrações estão
-- aplicadas (só versão e nome; nunca o conteúdo/statements). Só service_role
-- executa; anon e logado não. Sem tabela nova, sem DROP, sem NOTICE.
create or replace function public.migracoes_aplicadas()
returns table (version text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select m.version::text, coalesce(m.name, '')::text
    from supabase_migrations.schema_migrations m
   order by m.version desc
   limit 60
$$;
revoke all on function public.migracoes_aplicadas() from public, anon, authenticated;
grant execute on function public.migracoes_aplicadas() to service_role;
