-- 0368 (E1229, ORDENS-DUET 1143 e 1160 do Gerente, 27/11/2026): o tipo de evento "pagamento_anulado" na trilha do
-- contrato (contrato_eventos), para a anulação de um registro de pagamento (aluguel ou caução) gravar quem anulou —
-- o dono, antes da confirmação do morador, ou a Central, a pedido — com o pagamento, o documento, o valor, o motivo e
-- o caminho. A lista de tipos é fechada (0198 + 0225): o check é refeito com os mesmos 12 tipos e mais este.
-- E a função anular_pagamento (abaixo), que faz a anulação numa transação só.
-- O que NÃO faz: não grava, apaga nem muda evento nem pagamento nenhum ao aplicar. Sem dado pessoal.
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
