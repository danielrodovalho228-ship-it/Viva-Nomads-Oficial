-- Rollback da 0085: tira as colunas do disparo (perde só o histórico de disparos).
begin;
alter table public.agentes_ordens drop column if exists disparada_em, drop column if exists sessao_url, drop column if exists disparo_erro;
delete from supabase_migrations.schema_migrations where version = '20261007000085';
commit;
