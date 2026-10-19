-- Rollback da 0172: volta o SELECT de propostas por tabela, tira as colunas de origem e a faixa_dono (com o gatilho).
begin;
grant select on public.propostas to authenticated;
alter table public.leads drop constraint if exists leads_accepted_commission_origem_valida;
alter table public.leads drop column if exists accepted_commission_origem;
alter table public.leads drop column if exists accepted_commission_faixa;
alter table public.propostas drop constraint if exists propostas_taxa_origem_valida;
alter table public.propostas drop column if exists taxa_origem;
drop trigger if exists properties_faixa_dono on public.properties;
drop function if exists public.properties_faixa_dono();
drop function if exists public.atualizar_faixa_dono(uuid);
drop function if exists public.taxa_da_faixa(integer);
drop table if exists public.faixa_dono;
delete from supabase_migrations.schema_migrations where version = '20261019000172';
commit;
