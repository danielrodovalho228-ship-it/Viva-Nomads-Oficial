-- Rollback da 0099: volta os 5 degraus da 0096 e remove a coluna nova. Rodar no SQL Editor (tem DROP/DELETE).
begin;
set local lock_timeout = '5s';
alter table public.contratos drop constraint if exists contratos_tipo_cobranca_check;
alter table public.contratos drop column if exists tipo_cobranca;
delete from public.config_cobranca where chave in ('taxa_comissao', 'taxa_renovacao');
update public.faixas_comissao set max_imoveis = 2 where min_imoveis = 1;
insert into public.faixas_comissao (min_imoveis, max_imoveis, taxa) values
  (3, 5, 0.10), (6, 15, 0.08), (16, 30, 0.06), (31, null, 0.04)
on conflict (min_imoveis) do nothing;
delete from supabase_migrations.schema_migrations where version = '20261010000099';
commit;
