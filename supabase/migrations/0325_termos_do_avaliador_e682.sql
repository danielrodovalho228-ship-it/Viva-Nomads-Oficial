-- 0325 — E682: o avaliador declara os PRÓPRIOS termos (a lista de escolha do dono mostra cada um). Atrás de VISTORIA_ATIVA (desligada).
-- Só colunas novas, todas opcionais: quem não declarou continua escolhível (ele informa o valor e o prazo ao responder, como no E648).
--   preco_proprio        valor que o avaliador cobra pela avaliação (acertado direto com o dono; a Viva não cobra nem intermedeia)
--   prazo_entrega_dias   em quantos dias entrega o laudo (1 a 30)
--   prazo_resposta_horas em quantas horas responde a um pedido (1 a 72); sem resposta, o pedido volta ao dono (sem rodízio)
-- Rollback: supabase/producao/rollback/0325_rollback.sql
alter table public.avaliadores_credenciamento
  add column if not exists preco_proprio numeric(10, 2) check (preco_proprio is null or preco_proprio > 0),
  add column if not exists prazo_entrega_dias integer check (prazo_entrega_dias is null or prazo_entrega_dias between 1 and 30),
  add column if not exists prazo_resposta_horas integer check (prazo_resposta_horas is null or prazo_resposta_horas between 1 and 72);
