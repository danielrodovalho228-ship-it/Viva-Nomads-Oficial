-- Rollback da 0100: volta ao degrau único de 12% da 0099.
begin;
delete from public.faixas_comissao where min_imoveis > 1;
update public.faixas_comissao set max_imoveis = null, taxa = 0.12 where min_imoveis = 1;
delete from supabase_migrations.schema_migrations where version = '20261010000100';
commit;
