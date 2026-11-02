-- Rollback da 0283. ATENÇÃO: o código desta versão grava o pedido em `pedido_dominio`; voltar a coluna exige voltar o
-- código antes. Pedidos em andamento (sem selo) voltam para `dominio`.
begin;
update public.vinculo_profissional set dominio = pedido_dominio where confirmado_em is null and pedido_dominio is not null;
alter table public.vinculo_profissional drop column if exists pedido_dominio;
delete from supabase_migrations.schema_migrations where version = '20261102000283';
commit;
