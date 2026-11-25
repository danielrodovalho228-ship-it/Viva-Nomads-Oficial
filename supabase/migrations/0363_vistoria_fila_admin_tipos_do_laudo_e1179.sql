-- 0363 — E1179 (ORDENS-DUET 780 e 788): a fila da equipe volta a aceitar os quatro tipos do laudo.
--   A 0216 criou a regra com 'laudo_atrasado', 'ressalva_vencida', 'devolucao_vencida' e 'seguranca_grave'. A 0313
--   reescreveu a regra para acrescentar 'revisao_criterio' e deixou esses quatro de fora. A rotina do laudo continuou a
--   gravá-los; o banco recusava e ninguém via: o item nunca chegava à "Fila da equipe" de /admin/avaliadores.
--   Esta migração só troca a regra: os seis tipos em vigor (0362) e os quatro que faltavam. Nenhum dado é alterado.
--   Os itens que a rotina tentou gravar desde a 0313 não voltam por aqui: não chegaram a existir.
alter table public.vistoria_fila_admin drop constraint if exists vistoria_fila_admin_tipo_check;
alter table public.vistoria_fila_admin add constraint vistoria_fila_admin_tipo_check
  check (tipo in ('sem_avaliador', 'avaliacao_teste', 'suspensao_automatica', 'proposta_descredenciamento', 'revisao_criterio', 'contestacao_sem_avaliador', 'laudo_atrasado', 'ressalva_vencida', 'devolucao_vencida', 'seguranca_grave'));
