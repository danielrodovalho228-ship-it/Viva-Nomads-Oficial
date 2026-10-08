-- Rollback da 0091: tira o gatilho e a coluna calculada. O valor 'managed' do tipo
-- ownership_type FICA (o Postgres não remove valor de enum); imóveis 'managed' voltam
-- a ser tratados pelo código antigo como "próprio". Rodar no SQL Editor (tem DROP).
begin;
set local lock_timeout = '5s';
drop trigger if exists properties_exige_autorizacao on public.properties;
drop function if exists public.properties_exige_autorizacao();
alter table public.properties drop column if exists autorizacao_anexada;
delete from supabase_migrations.schema_migrations where version = '20261008000091';
commit;
