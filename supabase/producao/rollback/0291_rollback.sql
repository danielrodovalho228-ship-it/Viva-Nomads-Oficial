-- Rollback da 0291: tira o gatilho, os checks e as colunas `dias`/`limpezas_pacote` de proposta_versoes. Antes, devolve
-- a `meses` a duração arredondada para cima (já é o valor gravado: o gatilho mantinha meses = ceil(dias ÷ 30)).
-- ATENÇÃO: propostas feitas em dias exatos (ex.: 43 dias) perdem os dias — voltam a valer meses cheios. Volte o código
-- junto (o código do E562 grava `dias`).
begin;
set local lock_timeout = '5s';
drop trigger if exists proposta_versoes_dias on public.proposta_versoes;
drop function if exists public.proposta_versoes_dias();
alter table public.proposta_versoes drop constraint if exists proposta_versoes_dias_validos;
alter table public.proposta_versoes drop constraint if exists proposta_versoes_limpezas_pacote_valido;
alter table public.proposta_versoes drop column if exists limpezas_pacote;
alter table public.proposta_versoes drop column if exists dias;
delete from supabase_migrations.schema_migrations where version = '20261104000291';
commit;
