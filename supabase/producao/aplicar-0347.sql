-- Viva Nomads — aplicar 0347 (E1032: agentes_conversas.retorno_da_ordem com índice único; um Retorno do Moacir por
-- ordem). Idempotente. Aplicada pela Action quando o PR é mesclado. NÃO regrava nem apaga nenhuma linha existente (a
-- coluna fica nula nelas). Rollback: supabase/producao/rollback/0347_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'agentes_conversas' and column_name = 'retorno_da_ordem'
  ) then
    alter table public.agentes_conversas add column retorno_da_ordem uuid;
  end if;
end;
$$;

comment on column public.agentes_conversas.retorno_da_ordem is 'E1032: a ordem (agentes_ordens.id) de que esta mensagem é o Retorno do Moacir. Índice único: um Retorno por ordem. null = conversa comum, ou retorno anterior à 0347.';

do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'agentes_conversas_retorno_unico'
  ) then
    create unique index if not exists agentes_conversas_retorno_unico
      on public.agentes_conversas (retorno_da_ordem)
      where retorno_da_ordem is not null;
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name)
select '20261119000347', '0347_agentes_conversas_retorno_unico_e1032'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261119000347');
commit;
