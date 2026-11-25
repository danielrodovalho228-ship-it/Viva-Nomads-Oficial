-- Rollback da 0356: tira a coluna do aparelho da decisão (as decisões em si ficam como estão).
-- O gatilho de imutabilidade recusa UPDATE em linha decidida, mas DROP COLUMN não passa por ele.
begin;
alter table public.aprovacoes drop column if exists decidido_aparelho;
delete from supabase_migrations.schema_migrations where version = '20261122000356';
commit;
