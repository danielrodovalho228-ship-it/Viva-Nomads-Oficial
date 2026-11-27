-- Rollback da 0334: tira as colunas da pré-aceitação de 72 h (sem efeito na taxa nem no status das propostas).
begin;
drop index if exists public.propostas_pre_aceitacao_idx;
alter table public.propostas drop constraint if exists propostas_pre_aceitacao_reaberturas_valida;
alter table public.propostas drop column if exists pre_aceitacao_perdeu_em;
alter table public.propostas drop column if exists pre_aceitacao_encerrada_em;
alter table public.propostas drop column if exists pre_aceitacao_dono_ate;
alter table public.propostas drop column if exists pre_aceitacao_expirou_em;
alter table public.propostas drop column if exists pre_aceitacao_lembrete_6h_em;
alter table public.propostas drop column if exists pre_aceitacao_lembrete_24h_em;
alter table public.propostas drop column if exists pre_aceitacao_reaberturas;
alter table public.propostas drop column if exists pre_aceitacao_ate;
delete from supabase_migrations.schema_migrations where version = '20261107000334';
commit;
