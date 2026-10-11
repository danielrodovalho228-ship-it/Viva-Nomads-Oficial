-- Rollback da 0102: remove as tabelas de fotógrafos parceiros (perde pedidos e cadastros).
begin;
drop table if exists public.fotografo_pedidos;
drop table if exists public.fotografos_contato;
drop table if exists public.fotografos;
delete from public.config_parceria where chave = 'taxa_parceria_fotografo';
drop table if exists public.config_parceria;
delete from supabase_migrations.schema_migrations where version = '20261011000102';
commit;
