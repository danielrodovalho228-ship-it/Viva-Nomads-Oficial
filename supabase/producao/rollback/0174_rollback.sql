-- Rollback da 0174: apaga os pedidos de serviço e a coluna de preço do catálogo.
begin;
drop table if exists public.servicos_pedidos;
alter table public.servicos_adicionais drop column if exists preco_texto;
delete from supabase_migrations.schema_migrations where version = '20261019000174';
commit;
