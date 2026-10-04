-- ════════════════════════════════════════════════════════════════════════════
-- 0058 — Webhook do Asaas (PR 4, item 4). Pré-requisito para LIGAR o Asaas.
--
--   1. asaas_eventos: um registro por (pagamento, evento) já processado —
--      idempotência: o Asaas reenvia o mesmo aviso; só o 1º altera o banco.
--      Só o servidor (service role) lê/escreve.
--   2. cobrancas_fechamento ganha status (pendente | pago | vencido) e pago_em,
--      para o webhook marcar a comissão de fechamento.
--   3. subscriptions: id da assinatura no Asaas único (o webhook acha a linha
--      por ele).
--
-- Aditiva: não muda nada que o código atual da main use.
-- Rollback: supabase/producao/rollback/0058_rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.asaas_eventos (
  chave       text primary key,            -- '<payment.id>:<evento>'
  evento      text not null,
  payment_id  text,
  recebido_em timestamptz not null default now()
);
alter table public.asaas_eventos enable row level security;
revoke all on public.asaas_eventos from anon, authenticated;

alter table public.cobrancas_fechamento
  add column if not exists status text not null default 'pendente',
  add column if not exists pago_em timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.cobrancas_fechamento'::regclass
       and conname = 'cobrancas_fechamento_status_check'
  ) then
    alter table public.cobrancas_fechamento
      add constraint cobrancas_fechamento_status_check
      check (status in ('pendente', 'pago', 'vencido'));
  end if;
end $$;

create index if not exists cobrancas_fechamento_externo_idx
  on public.cobrancas_fechamento (externo_id) where externo_id is not null;

create unique index if not exists subscriptions_gateway_sub_uniq
  on public.subscriptions (gateway_subscription_id) where gateway_subscription_id is not null;
