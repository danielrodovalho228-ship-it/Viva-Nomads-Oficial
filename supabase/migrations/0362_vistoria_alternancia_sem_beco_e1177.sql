-- 0362 — E1177 (ORDENS-DUET 773, 778 e 780; decisão do coordenador): a alternância de avaliadores sem beco.
--   vistoria_pedidos.motivo_da_espera      por que o dono não tem lista comum para escolher. Vazio: há lista comum.
--                                          'so_o_anterior': a lista só tem o avaliador da avaliação anterior (o dono pode
--                                          escolhê-lo ou esperar outro; a rotina continua a procurar e avisa o dono).
--                                          Os outros valores são o motivo da lista vazia — é o que deixa a tela dizer
--                                          a verdade em vez de prometer sempre "a Viva avisa quando houver".
--   vistoria_designacoes.mesmo_da_anterior a designação recaiu no avaliador da avaliação anterior do imóvel, pela
--                                          exceção da alternância (não havia outro elegível na cidade).
--   vistoria_laudos.mesmo_da_anterior      o laudo foi emitido pelo mesmo avaliador da avaliação anterior, pela exceção.
--   vistoria_fila_admin                    ganha o tipo 'contestacao_sem_avaliador' (a contestação pede um avaliador
--                                          diferente do primeiro e a cidade não tem outro: a equipe decide).
--                                          A regra continua a aceitar SÓ os tipos que já aceitava mais este; os quatro
--                                          tipos do laudo que a 0313 deixou de fora são outro item (E1179).
-- Só acrescenta colunas e um valor aceito; não altera nem apaga dado. Idempotente.
-- Desfazer: supabase/producao/rollback/0362_rollback.sql.
alter table public.vistoria_pedidos
  add column if not exists motivo_da_espera text
  check (motivo_da_espera is null or motivo_da_espera in ('so_o_anterior', 'sem_avaliador_na_cidade', 'contestacao_sem_segundo', 'ja_escolhidos', 'independencia', 'indisponiveis', 'varios'));

comment on column public.vistoria_pedidos.motivo_da_espera is
  'E1177: por que o dono não tem lista comum para escolher. Nulo: há lista comum. so_o_anterior: só o avaliador da avaliação anterior.';

alter table public.vistoria_designacoes
  add column if not exists mesmo_da_anterior boolean not null default false;

comment on column public.vistoria_designacoes.mesmo_da_anterior is
  'E1177: o avaliador escolhido fez a avaliação anterior do imóvel e só pôde ser escolhido pela exceção da alternância.';

alter table public.vistoria_laudos
  add column if not exists mesmo_da_anterior boolean not null default false;

comment on column public.vistoria_laudos.mesmo_da_anterior is
  'E1177: laudo emitido pelo mesmo avaliador da avaliação anterior do imóvel, pela exceção da alternância.';

alter table public.vistoria_fila_admin drop constraint if exists vistoria_fila_admin_tipo_check;
alter table public.vistoria_fila_admin add constraint vistoria_fila_admin_tipo_check
  check (tipo in ('sem_avaliador', 'avaliacao_teste', 'suspensao_automatica', 'proposta_descredenciamento', 'revisao_criterio', 'contestacao_sem_avaliador'));
