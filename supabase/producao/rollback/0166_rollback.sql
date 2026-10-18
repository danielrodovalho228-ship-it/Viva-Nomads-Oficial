-- Rollback da 0166: tira a coluna erro_resumo de ia_chamadas (o código segue gravando sem ela).
begin;
alter table public.ia_chamadas drop constraint if exists ia_chamadas_erro_resumo_tam;
alter table public.ia_chamadas drop column if exists erro_resumo;
delete from supabase_migrations.schema_migrations where version = '20261018000166';
commit;
