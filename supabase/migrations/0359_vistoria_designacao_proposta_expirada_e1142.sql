-- 0359 — E1142 (ORDEM-DUET-621): o registo da proposta de avaliação que venceu sem o aceite do dono.
--   proposta_expirada_em  o instante em que o prazo do dono (72 h depois da proposta) acabou. Só é preenchido pela
--                         rotina da avaliação, no mesmo passo em que a designação passa de 'aceita' a 'expirada'.
--   Porquê uma coluna: 'expirada' já quer dizer "o avaliador não respondeu no prazo" (é assim que a lista dele e a
--   Central a leem). Sem esta marca, a expiração que foi do DONO apareceria como silêncio do avaliador.
-- Só acrescenta coluna opcional; idempotente. Desfazer: supabase/producao/rollback/0359_rollback.sql.
alter table public.vistoria_designacoes add column if not exists proposta_expirada_em timestamptz;

comment on column public.vistoria_designacoes.proposta_expirada_em is
  'Quando o prazo do dono para aceitar a proposta acabou sem o aceite. Nulo nas outras designações.';
