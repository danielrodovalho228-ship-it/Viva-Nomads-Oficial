-- Rollback da 0156: o dono deixa de decidir; decisões já tomadas voltam para 'enviado_dono'.
begin;
drop policy if exists ajuda_publicacao_dono_decide on public.pedidos_ajuda_publicacao;
update public.pedidos_ajuda_publicacao set status = 'enviado_dono' where status in ('aprovado_dono', 'ajustes_pedidos');
alter table public.pedidos_ajuda_publicacao drop constraint if exists pedidos_ajuda_publicacao_status_check;
alter table public.pedidos_ajuda_publicacao add constraint pedidos_ajuda_publicacao_status_check
  check (status in ('recebido', 'em_montagem', 'enviado_dono', 'cancelado'));
delete from supabase_migrations.schema_migrations where version = '20261018000156';
commit;
