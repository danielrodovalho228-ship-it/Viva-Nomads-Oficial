-- Rollback da 0256: remove a massa do QA ao vivo do E235 pelos ids fixos a0256000-… (o laudo cai junto com o pedido, em
-- cascata; apagado também direto, por garantia). Nada fora desses ids é tocado; as contas e o anúncio de teste ficam.
begin;
set local lock_timeout = '5s';
delete from public.vistoria_laudos where id = 'a0256000-0000-4000-8000-0000000000b1';
delete from public.vistoria_pedidos where id in ('a0256000-0000-4000-8000-0000000000a1', 'a0256000-0000-4000-8000-0000000000a2');
delete from supabase_migrations.schema_migrations where version = '20261030000256';
commit;
