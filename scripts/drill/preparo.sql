-- Teste de restauração: prepara um Postgres 17 "puro" (o serviço postgres:17 do job) para receber o dump do Supabase.
-- O dump vem com --no-owner --no-privileges, mas as políticas de RLS citam os papéis do Supabase (anon, authenticated,
-- service_role…) e algumas colunas usam funções de extensões do schema "extensions". Aqui só criamos o que falta,
-- sem dado nenhum. Idempotente: pode rodar num banco que já tenha os papéis (ex.: a imagem supabase/postgres).
do $$
declare
  r text;
begin
  foreach r in array array[
    'anon', 'authenticated', 'service_role', 'authenticator', 'dashboard_user', 'pgbouncer',
    'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin', 'supabase_functions_admin',
    'supabase_realtime_admin', 'supabase_replication_admin', 'supabase_read_only_user'
  ] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end;
$$;

create schema if not exists extensions;

-- O dump recria o schema public (com os comentários e as políticas); num banco novo ele está vazio.
drop schema if exists public cascade;

-- Só as extensões que existem num Postgres 17 comum (contrib). pg_cron, pg_net, vault e pgsodium ficam de fora:
-- o dump não leva esses schemas, e as funções que os citam não são validadas na restauração.
do $$
declare
  e text;
begin
  foreach e in array array['pgcrypto', 'uuid-ossp', 'btree_gist', 'pg_trgm', 'citext', 'unaccent', 'fuzzystrmatch'] loop
    if exists (select 1 from pg_available_extensions where name = e) then
      execute format('create extension if not exists %I with schema extensions', e);
    end if;
  end loop;
end;
$$;

-- A publicação do Realtime: o dump pode trazer "alter publication supabase_realtime add table …".
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

-- As funções do Supabase procuram "extensions" no search_path.
do $$
begin
  execute format('alter database %I set search_path = "$user", public, extensions', current_database());
end;
$$;
