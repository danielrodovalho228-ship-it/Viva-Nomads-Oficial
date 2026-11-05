-- 0296 — E486 (só a massa): estadia ATIVA de teste para a moradora de teste inquilino2@ (Ana), para destravar a prova
-- ao vivo da manutenção do E485. Hoje a única estadia dela é a seed do D-5 (VN-CT-D5D50247, encerrada) — INTOCÁVEL.
-- Cria um contrato EM VIGÊNCIA (o que a manutenção exige: status ativo + as duas assinaturas + o 1º aluguel confirmado
-- pela moradora — contratoPermiteManutencao/estadoDoContratoUnico) no anúncio de teste
-- "TESTE QA - Casa mobiliada 2 quartos no Centro" (4a693a63, do proprietario2@, sem contrato nenhum), 1 bloco de
-- 2 meses de D-7 a D+52 (60 dias), caução, R$ 3.200/mês. Datas relativas ao dia da aplicação (D).
-- Não toca a seed do D-5 (contrato d5d50247…, Premium 330ebf37, parceiro de proprietario3cnpj@), nem outras massas
-- (0247/0260/0261/0263/0276), nem chaves. Os pedidos de moradia da Ana são guardados e devolvidos (o gatilho
-- pedido_atendido_no_contrato não muda nada fora daqui). Ids fixos e4860000-… (contrato e4860000-…-0000000000c1 →
-- VN-CT-E4860000); idempotente. Desfazer: supabase/producao/rollback/0296_rollback.sql.
do $$
declare
  v_dono uuid;
  v_morador uuid;
  c_imovel constant uuid := '4a693a63-8f4e-453c-a888-cd0ea9ccc4ff'; -- TESTE QA - Casa mobiliada 2 quartos no Centro
  c_contrato constant uuid := 'e4860000-0000-4000-8000-0000000000c1';
  c_bloco constant uuid := 'e4860000-0000-4000-8000-0000000000b1';
  c_pagamento constant uuid := 'e4860000-0000-4000-8000-0000000000a1';
  v_inicio date := current_date - 7;
  v_fim date := current_date + 52;
  v_pedidos jsonb;
begin
  select id into v_dono from public.profiles where lower(email) = 'proprietario2@vivanomads.com.br' and is_teste;
  select id into v_morador from public.profiles where lower(email) = 'inquilino2@vivanomads.com.br' and is_teste;
  if v_dono is null or v_morador is null then
    raise notice '0296: contas de teste ausentes ou não marcadas como teste; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.contratos where id = c_contrato) then
    raise notice '0296: a estadia de teste já existe; nada a fazer';
    return;
  end if;
  if not exists (select 1 from public.properties where id = c_imovel and owner_id = v_dono and status = 'active' and title like 'TESTE QA%') then
    raise notice '0296: anúncio de teste 4a693a63 ausente, inativo ou de outro dono; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.contratos where property_id = c_imovel and status in ('ativo', 'encerrado_em_acerto')) then
    raise notice '0296: o anúncio de teste já tem estadia ativa; nada a fazer (sem sobreposição)';
    return;
  end if;
  if exists (select 1 from public.contratos where tenant_id = v_morador and status in ('ativo', 'encerrado_em_acerto')) then
    raise notice '0296: a moradora de teste já tem estadia ativa; nada a fazer';
    return;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'status', status)), '[]'::jsonb) into v_pedidos
    from public.pedidos_moradia where inquilino_id = v_morador;

  -- 1) O contrato: ativo e assinado pelas duas partes na véspera do início.
  insert into public.contratos (id, property_id, tenant_id, status, faixa, periodo, garantia, owner_plan, multa_status,
                                qtd_ocupantes, aluguel_mensal, comissao_percent, comissao_valor, prazo_total_dias,
                                tamanho_bloco_meses, assinado_proprietario_em, assinado_inquilino_em)
  values (c_contrato, c_imovel, v_morador, 'ativo', 'temporada', daterange(v_inicio, v_fim + 1, '[)'), 'caucao', 'free', 'nenhuma',
          1, 3200, 0.12, 768, (v_fim - v_inicio + 1), 2,
          (v_inicio - 1)::timestamptz + interval '12 hours', (v_inicio - 1)::timestamptz + interval '12 hours');

  -- 2) O bloco 1 (2 meses), ativo.
  insert into public.contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, caucao_forma, caucao_status, status)
  values (c_bloco, c_contrato, 1, v_inicio, v_fim, 2, 6400, 3200, 'avista', 'pendente', 'ativo');

  -- 3) O 1º aluguel, marcado pelo dono e confirmado pela moradora → "Em vigência".
  insert into public.pagamentos_bloco (id, bloco_id, contrato_id, tipo, valor, forma, data_pagamento, marcado_por,
                                       confirmado_pelo_inquilino, confirmado_em, observacao)
  values (c_pagamento, c_bloco, c_contrato, 'aluguel', 3200, 'pix', v_inicio, v_dono, true,
          v_inicio::timestamptz + interval '15 hours', 'Massa de teste do E486 (prova da manutenção do E485).');

  update public.pedidos_moradia pm
     set status = antes.status
    from jsonb_to_recordset(v_pedidos) as antes(id uuid, status text)
   where pm.id = antes.id and pm.status is distinct from antes.status;

  raise notice '0296: estadia de teste criada — VN-CT-E4860000, inquilino2@ × 4a693a63, em vigência';
end
$$;
