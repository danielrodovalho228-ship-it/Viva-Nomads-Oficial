-- 0368 (E1229, ORDENS-DUET 1143 e 1160 do Gerente, 27/11/2026): o tipo de evento "pagamento_anulado" na trilha do
-- contrato (contrato_eventos), para a anulação de um registro de pagamento (aluguel ou caução) gravar quem anulou —
-- o dono, antes da confirmação do morador, ou a Central, a pedido — com o pagamento, o documento, o valor, o motivo e
-- o caminho. A lista de tipos é fechada (0198 + 0225): o check é refeito com os mesmos 12 tipos e mais este.
-- O que NÃO faz: não grava, apaga nem muda evento nenhum. Sem dado pessoal.
alter table public.contrato_eventos drop constraint if exists contrato_eventos_tipo_check;
alter table public.contrato_eventos add constraint contrato_eventos_tipo_check check (tipo in (
  'aditivo_proposto', 'aditivo_aceito', 'aditivo_recusado', 'aditivo_expirado', 'estadia_remarcada',
  'encerramento_pedido', 'contrato_encerrado', 'instrucoes_liberadas', 'ocupantes_apagados',
  'convidado_adicionado', 'convidado_removido', 'convidados_apagados'
));
