-- Rollback da 0280 (E399-C pacote 2): tira as colunas da comparação. A tabela da 0279 fica.
begin;
set local lock_timeout = '5s';
drop index if exists public.preco_justo_airbnb_consulta_idx;
alter table public.preco_justo_airbnb drop column if exists aviso_valor;
alter table public.preco_justo_airbnb drop column if exists aviso_enviado_em;
alter table public.preco_justo_airbnb drop column if exists consultado_em;
alter table public.preco_justo_airbnb drop column if exists total_30_noites;
delete from supabase_migrations.schema_migrations where version = '20261101000280';
commit;
