-- ROLLBACK da 0071 (financeiro). Perde o histórico de assinaturas e o livro de
-- recebimentos gravados desde a aplicação — exporte antes se precisar.
begin;
drop function if exists public.admin_financeiro(date, date, text);
drop function if exists public.admin_assinaturas_em(timestamptz);
drop trigger if exists trg_assinatura_evento on public.subscriptions;
drop function if exists public.registra_assinatura_evento();
drop table if exists public.recebimentos;
drop table if exists public.assinatura_eventos;
commit;
