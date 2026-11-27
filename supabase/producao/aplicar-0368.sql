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

-- ORDEM-DUET-1169 (correção B do coordenador): a anulação é UMA operação — numa transação só, ou tudo, ou nada: o
-- pagamento (só o que não está anulado e, no caminho do dono, só o que o morador ainda não confirmou), o documento
-- ligado (REC/CAU) e o evento de quem anulou. Chamada só pelo servidor (service role); as pessoas não a executam.
create or replace function public.anular_pagamento(p_pagamento uuid, p_motivo text, p_autor uuid, p_caminho text, p_chamado text default null)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare
  v_agora timestamptz := now();
  v_contrato uuid;
  v_valor numeric;
  v_documento text;
begin
  if p_caminho is null or p_caminho not in ('dono', 'central') then
    raise exception 'anular_pagamento: caminho inválido' using errcode = '22023';
  end if;
  update public.pagamentos_bloco set anulado_em = v_agora, anulado_motivo = p_motivo
   where id = p_pagamento and anulado_em is null and (p_caminho = 'central' or confirmado_pelo_inquilino = false)
   returning contrato_id, valor into v_contrato, v_valor;
  if v_contrato is null then
    return jsonb_build_object('ok', false);
  end if;
  update public.documentos_fiscais set anulado_em = v_agora, anulado_motivo = p_motivo where pagamento_id = p_pagamento and anulado_em is null
   returning numero into v_documento;
  insert into public.contrato_eventos (contrato_id, tipo, autor_id, dados)
  values (v_contrato, 'pagamento_anulado', p_autor,
          jsonb_build_object('caminho', p_caminho, 'pagamento_id', p_pagamento, 'documento', v_documento, 'valor', v_valor, 'motivo', p_motivo)
          || case when p_chamado is not null then jsonb_build_object('chamado', p_chamado) else '{}'::jsonb end);
  return jsonb_build_object('ok', true, 'documento', v_documento);
end;
$f$;
revoke all on function public.anular_pagamento(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.anular_pagamento(uuid, text, uuid, text, text) to service_role;

insert into supabase_migrations.schema_migrations (version, name)
select '20261127000368', '0368_contrato_eventos_pagamento_anulado_e1229'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261127000368');
commit;
