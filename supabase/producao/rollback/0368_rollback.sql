-- Viva Nomads — rollback da 0368 (E1229): volta a lista de tipos de evento do contrato sem "pagamento_anulado". Nunca
-- roda sozinho.
-- ATENÇÃO: se já houver eventos "pagamento_anulado" gravados, o check antigo FALHA e a transação inteira é desfeita —
-- nada muda (a função anular_pagamento também fica). Este script não apaga evento nenhum: a trilha de quem anulou fica.
begin;
set local lock_timeout = '5s';
alter table public.contrato_eventos drop constraint if exists contrato_eventos_tipo_check;
alter table public.contrato_eventos add constraint contrato_eventos_tipo_check check (tipo in (
  'aditivo_proposto', 'aditivo_aceito', 'aditivo_recusado', 'aditivo_expirado', 'estadia_remarcada',
  'encerramento_pedido', 'contrato_encerrado', 'instrucoes_liberadas', 'ocupantes_apagados',
  'convidado_adicionado', 'convidado_removido', 'convidados_apagados'
));
delete from supabase_migrations.schema_migrations where version = '20261127000368';
commit;
