-- Rollback da 0185: tira as funções do aviso agrupado e a coluna decisao_avisada_em (o código volta a avisar por decisão).
begin;
drop function if exists public.decisoes_documento_para_avisar(uuid, uuid, boolean);
drop function if exists public.decisoes_documento_atrasadas(int);
alter table public.qualification_checklists drop column if exists decisao_avisada_em;
alter table public.property_ownership_checks drop column if exists decisao_avisada_em;
delete from supabase_migrations.schema_migrations where version = '20261019000185';
commit;
