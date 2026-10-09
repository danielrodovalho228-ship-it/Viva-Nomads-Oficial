-- Rollback da 0096: remove as tabelas de config de cobrança e as colunas novas do contrato (nulas até a parte 2).
-- Rodar no SQL Editor (tem DROP).
begin;
set local lock_timeout = '5s';
alter table public.contratos drop column if exists modelo_cobranca;
alter table public.contratos drop column if exists taxa_aplicada;
alter table public.contratos drop column if exists valor_comissao;
alter table public.contratos drop column if exists faixa_no_fechamento;
drop table if exists public.comissao_fixada_admin;
drop table if exists public.faixas_assinatura;
drop table if exists public.faixas_comissao;
drop table if exists public.config_cobranca;
delete from supabase_migrations.schema_migrations where version = '20261009000096';
commit;
