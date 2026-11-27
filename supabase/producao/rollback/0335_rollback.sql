-- Rollback da 0335: tira as colunas da decisão automática (sem efeito no status dos avaliadores).
begin;
alter table public.avaliadores_credenciamento drop column if exists criterios_decisao;
alter table public.avaliadores_credenciamento drop column if exists decidido_pelo_sistema;
delete from supabase_migrations.schema_migrations where version = '20261107000335';
commit;
