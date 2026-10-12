-- Rollback da 0109: apaga o histórico das ordens (service_order_eventos) e a regra de tamanho das mensagens.
-- As mensagens já trocadas ficam. Os padrões "ligado" das notificações ficam (eram assim desde a 0028).
begin;
drop table if exists public.service_order_eventos;
drop index if exists public.service_order_messages_ordem_idx;
alter table public.service_order_messages drop constraint if exists service_order_messages_body_tamanho;
delete from supabase_migrations.schema_migrations where version = '20261012000109';
commit;
