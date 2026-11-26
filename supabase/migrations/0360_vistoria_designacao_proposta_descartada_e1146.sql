-- 0360 — E1146 (ORDEM-DUET-631): o registo da proposta de avaliação que o DONO descartou ("Escolher outro avaliador").
--   proposta_descartada_em  o instante em que o dono descartou o avaliador escolhido e a proposta dele. Só é preenchido
--                           pela ação do dono, no mesmo passo em que a designação passa de 'aceita' a 'recusada'.
--   Porquê uma coluna: 'recusada' já quer dizer "o avaliador recusou" (é assim que a lista dele e a Central a leem).
--   Sem esta marca, o descarte que foi do DONO apareceria como recusa do avaliador. É a irmã da 0359 (a proposta
--   que venceu sem o aceite).
-- Só acrescenta coluna opcional; idempotente. Desfazer: supabase/producao/rollback/0360_rollback.sql.
alter table public.vistoria_designacoes add column if not exists proposta_descartada_em timestamptz;

comment on column public.vistoria_designacoes.proposta_descartada_em is
  'Quando o dono descartou o avaliador escolhido e a proposta dele. Nulo nas outras designações.';
