-- Rollback da 0327: saem os 3 anúncios-semente, os contratos (blocos, pagamentos e pedidos de limpeza saem em cascata
-- pelos ids fixos). Os pedidos de limpeza e seus eventos são apagados antes, pelos ids fixos.
begin;
set local lock_timeout = '5s';
delete from public.parceiro_pedidos where id in ('a0327a00-0000-4000-8000-000000000031', 'a0327c00-0000-4000-8000-000000000031');
delete from public.contratos where id in ('a0327a00-0000-4000-8000-000000000011', 'a0327b00-0000-4000-8000-000000000011', 'a0327c00-0000-4000-8000-000000000011');
delete from public.properties where id in ('a0327a00-0000-4000-8000-000000000001', 'a0327b00-0000-4000-8000-000000000001', 'a0327c00-0000-4000-8000-000000000001');
delete from supabase_migrations.schema_migrations where version = '20261107000327';
commit;
