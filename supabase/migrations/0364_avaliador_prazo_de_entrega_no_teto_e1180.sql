-- 0364 — E1180 (ORDENS-DUET 824 e 835): o prazo de entrega do laudo que o avaliador declara no credenciamento passa a
--   aceitar de 1 a 5 dias na base, o teto que a aplicação já impõe (regra dos dias úteis, E1156).
--   A 0325 criou a coluna prazo_entrega_dias com a regra antiga, de 1 a 30. A aplicação só deixa gravar de 1 a 5, mas a
--   base aceitava mais: quem escrevesse direto, ou um código futuro sem a validação, guardava um prazo que a aplicação
--   não reconhece.
--   Só a regra muda; nenhum dado é alterado. As duas ações vão na mesma instrução: se alguma linha estiver acima de 5,
--   a regra nova não entra e a antiga não sai.
--   Fica de fora, de propósito, a outra coluna com 1 a 30 (vistoria_pedidos.prazo_proposto_dias): guarda o que foi
--   proposto em pedidos anteriores à regra dos dias úteis.
-- Rollback: supabase/producao/rollback/0364_rollback.sql
alter table public.avaliadores_credenciamento
  drop constraint if exists avaliadores_credenciamento_prazo_entrega_dias_check,
  add constraint avaliadores_credenciamento_prazo_entrega_dias_check
  check (prazo_entrega_dias is null or prazo_entrega_dias between 1 and 5);
