-- Viva Nomads — aplicar 0368 (E1229: o tipo "pagamento_anulado" na trilha do contrato). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Não grava nem muda evento nenhum.
-- Rollback: supabase/producao/rollback/0368_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.contrato_eventos drop constraint if exists contrato_eventos_tipo_check;
alter table public.contrato_eventos add constraint contrato_eventos_tipo_check check (tipo in (
  'aditivo_proposto', 'aditivo_aceito', 'aditivo_recusado', 'aditivo_expirado', 'estadia_remarcada',
  'encerramento_pedido', 'contrato_encerrado', 'instrucoes_liberadas', 'ocupantes_apagados',
  'convidado_adicionado', 'convidado_removido', 'convidados_apagados',
  'pagamento_anulado'
));

alter table public.contrato_eventos drop constraint "contrato_eventos_tipo_check";
insert into supabase_migrations.schema_migrations (version, name)
select '20261127000368', '0368_contrato_eventos_pagamento_anulado_e1229'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261127000368');
commit;
