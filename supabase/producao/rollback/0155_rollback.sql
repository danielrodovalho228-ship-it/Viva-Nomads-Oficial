-- Rollback da 0155: remove a fila "Publicamos para você" (os pedidos recebidos são apagados).
begin;
drop table if exists public.pedidos_ajuda_publicacao;
delete from supabase_migrations.schema_migrations where version = '20261018000155';
commit;
