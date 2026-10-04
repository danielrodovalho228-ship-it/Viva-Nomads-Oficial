-- ROLLBACK da 0064 (pedido_compatibilidade). O código volta a não ter a função
-- de compatibilidade (os avisos param). Colunas novas do pedido ficam.
begin;
drop function if exists public.admin_metricas_pedidos(int);
drop function if exists public.compatibilidade_pedidos(uuid, uuid, uuid);
drop table if exists public.pedido_avisos;
commit;
