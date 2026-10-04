-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK da 0058 (asaas_webhook). Rode tudo de uma vez no SQL Editor.
-- Apaga o registro de eventos processados e o status das comissões.
-- ════════════════════════════════════════════════════════════════════════════
begin;
drop index if exists public.subscriptions_gateway_sub_uniq;
drop index if exists public.cobrancas_fechamento_externo_idx;
alter table public.cobrancas_fechamento drop constraint if exists cobrancas_fechamento_status_check;
alter table public.cobrancas_fechamento drop column if exists pago_em;
alter table public.cobrancas_fechamento drop column if exists status;
drop table if exists public.asaas_eventos;
commit;
