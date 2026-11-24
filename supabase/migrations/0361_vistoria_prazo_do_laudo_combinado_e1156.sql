-- 0361 — E1156 (ORDENS-DUET 712 e 713): o prazo do LAUDO combinado com o avaliador, em dias úteis depois da visita.
--   prazo_laudo_dias_uteis  o prazo que o avaliador propôs e o dono aceitou, de 1 a 5 dias úteis (o teto da regra).
--                           Gravado pela proposta do avaliador; apagado quando o pedido volta ao dono.
--   Porquê uma coluna: os pedidos já abertos mantêm a promessa que receberam. Neles a coluna fica nula, e o laudo
--   conta pelo padrão de 2 dias úteis depois da visita — as mesmas 48 horas úteis de antes. O prazo_proposto_dias
--   antigo (1 a 30 dias, contados de outra forma) continua como está.
-- Só acrescenta coluna opcional; idempotente. Desfazer: supabase/producao/rollback/0361_rollback.sql.
alter table public.vistoria_pedidos
  add column if not exists prazo_laudo_dias_uteis smallint
  check (prazo_laudo_dias_uteis is null or (prazo_laudo_dias_uteis between 1 and 5));

comment on column public.vistoria_pedidos.prazo_laudo_dias_uteis is
  'Prazo do laudo combinado com o avaliador, em dias úteis depois da visita (1 a 5). Nulo: vale o padrão de 2 dias úteis.';
