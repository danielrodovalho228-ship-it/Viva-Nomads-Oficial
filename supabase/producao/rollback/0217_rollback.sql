-- Viva Nomads — rollback da 0217 (ativação por papel e análise humana da verificação — Prompt 50). Idempotente.
-- Apaga as datas de ativação (o checklist volta a decidir pelo fato) e a fila de análise humana.
begin;
set local lock_timeout = '5s';
drop table if exists public.verificacao_revisoes;
drop table if exists public.ativacoes;
delete from supabase_migrations.schema_migrations where version = '20261023000217';
commit;
