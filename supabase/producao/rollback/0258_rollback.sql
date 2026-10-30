-- Rollback da 0258: sai a coluna da saída desejada (a candidatura volta a guardar só a entrada; a saída segue na mensagem).
begin;
set local lock_timeout = '5s';
alter table public.leads drop constraint if exists leads_fim_desejado_chk;
alter table public.leads drop column if exists fim_desejado;
delete from supabase_migrations.schema_migrations where version = '20261030000258';
commit;
